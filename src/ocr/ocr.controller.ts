import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ok } from '../common/utils/response';
import { ExtractOcrDto } from './dto/extract-ocr.dto';
import { OcrService } from './ocr.service';

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('extract')
  async extract(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ExtractOcrDto,
  ) {
    const result = await this.ocrService.extractFromUpload(user.id, body);
    return ok(result, 'OCR extracted');
  }
}
