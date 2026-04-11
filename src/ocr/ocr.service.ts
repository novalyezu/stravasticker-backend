import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { activities, uploads } from '../database/schema';
import { R2Service } from '../storage/r2.service';
import { UploadsService } from '../uploads/uploads.service';
import { ExtractOcrDto } from './dto/extract-ocr.dto';
import {
  parseBase64DataUri,
  parseActivityDate,
} from './ocr-normalization.util';

type MistralParsedResult = {
  stats: Record<string, unknown>;
  runningPathImageBase64: string | null;
};

@Injectable()
export class OcrService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly uploadsService: UploadsService,
    private readonly r2Service: R2Service,
  ) {}

  async extractFromUpload(userId: string, dto: ExtractOcrDto) {
    const upload = await this.uploadsService.getOwnedUploadById(
      dto.uploadId,
      userId,
    );
    if (!upload) {
      throw new BadRequestException('Upload not found');
    }
    if (upload.status !== 'uploaded') {
      throw new BadRequestException('Upload is not ready for OCR extraction');
    }

    const sourceImageBuffer = await this.r2Service.getObjectBuffer(upload.key);
    const parsed = await this.callMistralOcr(
      upload.mimeType,
      sourceImageBuffer,
    );

    const stats = parsed.stats;
    const distance = this.readStatAsString(stats.distance);
    const pace = this.readStatAsString(stats.pace);
    const time = this.readStatAsString(stats.time ?? stats.duration);
    const activityDate = parseActivityDate(stats.activity_date ?? stats.date);

    let runningPathKey: string | null = null;
    if (parsed.runningPathImageBase64) {
      const parsedDataUri = parseBase64DataUri(parsed.runningPathImageBase64);
      const runningPathBuffer = Buffer.from(parsedDataUri.data, 'base64');
      if (runningPathBuffer.length > 0) {
        const extension = parsedDataUri.extension || 'png';
        const contentType = parsedDataUri.mimeType ?? 'image/png';
        runningPathKey = `paths/${userId}/${uuidv7()}.${extension}`;
        await this.r2Service.uploadBuffer(
          runningPathKey,
          runningPathBuffer,
          contentType,
        );
      }
    }

    const now = new Date();
    const activityId = uuidv7();
    const [createdActivity] = await this.databaseService.db
      .insert(activities)
      .values({
        id: activityId,
        userId,
        uploadId: upload.id,
        sportType: 'running',
        sourceType: 'strava_sticker',
        activityDate,
        distance,
        pace,
        time,
        statsJson: stats,
        runningPathKey,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await this.databaseService.db
      .update(uploads)
      .set({
        status: 'processed',
        updatedAt: now,
      })
      .where(and(eq(uploads.id, upload.id), eq(uploads.userId, userId)));

    return {
      activity: createdActivity,
      runningPathImageBase64: parsed.runningPathImageBase64,
    };
  }

  private async callMistralOcr(
    mimeType: string,
    imageBuffer: Buffer,
  ): Promise<MistralParsedResult> {
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MISTRAL_API_KEY is not configured',
      );
    }

    const model =
      this.configService.get<string>('MISTRAL_MODEL') ?? 'mistral-ocr-latest';
    const base64Image = imageBuffer.toString('base64');
    const imageDataUri = `data:${mimeType};base64,${base64Image}`;

    const controller = new AbortController();
    const timeoutMs = Number(
      this.configService.get<string>('OCR_TIMEOUT_MS') ?? 25000,
    );
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          document: {
            type: 'image_url',
            image_url: {
              url: imageDataUri,
            },
          },
          include_image_base64: true,
          document_annotation_prompt:
            'Analyze this document as an athlete coach.',
          document_annotation_format: {
            type: 'json_schema',
            json_schema: {
              name: 'Summary',
              schema: {
                type: 'object',
                description:
                  'Schema for defining a summary of running statistics',
                properties: {
                  distance: {
                    type: 'string',
                    description:
                      'Distance of the running (example: 10.14 km), copy exactly from the image',
                  },
                  pace: {
                    type: 'string',
                    description:
                      'Pace of the running (example: 8:23 /km), copy exactly from the image',
                  },
                  time: {
                    type: 'string',
                    description:
                      'Running time (example: 1h 29m), copy exactly from the image',
                  },
                  activity_date: {
                    type: ['string', 'null'],
                    description:
                      'Date/time of activity if present in the image, otherwise null',
                  },
                },
                required: ['distance', 'pace', 'time'],
              },
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const reason = await response.text();
        throw new BadGatewayException(
          `Mistral OCR request failed with status ${response.status}: ${reason}`,
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      const stats = this.readStatsFromOcrResponse(json);
      const runningPathImageBase64 =
        this.readRunningPathBase64FromOcrResponse(json);

      return {
        stats,
        runningPathImageBase64,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if ((error as { name?: string }).name === 'AbortError') {
        throw new GatewayTimeoutException('OCR request timed out');
      }
      throw new BadGatewayException('Failed to process OCR response');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJson(text: string): Record<string, unknown> {
    const cleaned = text
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('Invalid JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadGatewayException('Failed to parse OCR JSON payload');
    }
  }

  private readStatsFromOcrResponse(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const directAnnotation = this.readObjectLike(payload.document_annotation);
    const directStats = this.findStatsObject(directAnnotation);
    if (directStats) {
      return directStats;
    }

    const parsedAnnotation = this.readJsonStringObject(
      payload.document_annotation,
    );
    const parsedStats = this.findStatsObject(parsedAnnotation);
    if (parsedStats) {
      return parsedStats;
    }

    const payloadStats = this.findStatsObject(payload);
    return payloadStats ?? {};
  }

  private readRunningPathBase64FromOcrResponse(
    payload: Record<string, unknown>,
  ): string | null {
    const image = this.findFirstImageBase64(payload);
    if (image) {
      return image;
    }

    const explicit = payload.running_path_image_base64;
    if (typeof explicit === 'string' && explicit.trim().length > 0) {
      return explicit;
    }

    return null;
  }

  private readObjectLike(value: unknown): Record<string, unknown> | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private readJsonStringObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'string') {
      return null;
    }

    try {
      return this.parseJson(value);
    } catch {
      return null;
    }
  }

  private findStatsObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.findStatsObject(item);
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    if (
      'distance' in record ||
      'pace' in record ||
      'time' in record ||
      'duration' in record
    ) {
      return record;
    }

    for (const nestedValue of Object.values(record)) {
      const nested = this.findStatsObject(nestedValue);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private findFirstImageBase64(value: unknown): string | null {
    if (typeof value === 'string') {
      return value.includes('base64') ? value : null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.findFirstImageBase64(item);
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const [key, nestedValue] of Object.entries(record)) {
      if (
        key.toLowerCase().includes('image_base64') &&
        typeof nestedValue === 'string' &&
        nestedValue.trim().length > 0
      ) {
        return nestedValue;
      }

      const nested = this.findFirstImageBase64(nestedValue);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private readStatAsString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }
}
