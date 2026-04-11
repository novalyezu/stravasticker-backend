import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { uploads } from '../database/schema';
import { R2Service } from '../storage/r2.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/jpg',
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly r2Service: R2Service,
  ) {}

  async createPresignUrl(userId: string, dto: PresignUploadDto) {
    this.validateFile(dto.mimeType, dto.fileSize);

    const safeFileName = sanitizeFileName(dto.fileName);
    const key = `uploads/${userId}/${uuidv7()}-${safeFileName}`;
    const uploadUrl = await this.r2Service.createPresignedPutUrl(
      key,
      dto.mimeType,
      900,
    );

    return { uploadUrl, key };
  }

  async completeUpload(userId: string, dto: CompleteUploadDto) {
    this.validateFile(dto.mimeType, dto.fileSize);
    if (!this.isUserOwnedKey(dto.key, userId)) {
      throw new BadRequestException(
        'Upload key does not belong to authenticated user',
      );
    }

    const exists = await this.r2Service.objectExists(dto.key);
    if (!exists) {
      throw new BadRequestException('Uploaded object not found in storage');
    }

    const existingUpload =
      await this.databaseService.db.query.uploads.findFirst({
        where: and(eq(uploads.key, dto.key), eq(uploads.userId, userId)),
      });

    if (existingUpload) {
      return { uploadId: existingUpload.id };
    }

    const now = new Date();
    const uploadId = uuidv7();
    await this.databaseService.db.insert(uploads).values({
      id: uploadId,
      userId,
      key: dto.key,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
    });

    return { uploadId };
  }

  async getOwnedUploadById(uploadId: string, userId: string) {
    return this.databaseService.db.query.uploads.findFirst({
      where: and(eq(uploads.id, uploadId), eq(uploads.userId, userId)),
    });
  }

  private validateFile(mimeType: string, fileSize: number): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestException('Unsupported file type');
    }

    if (fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File size exceeds 5 MB limit');
    }
  }

  private isUserOwnedKey(key: string, userId: string): boolean {
    return key.startsWith(`uploads/${userId}/`);
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');

  if (!sanitized) {
    return 'upload-image';
  }

  return sanitized.slice(0, 100);
}
