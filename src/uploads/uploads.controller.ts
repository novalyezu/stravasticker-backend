import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ok } from '../common/utils/response';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  async presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignUploadDto,
  ) {
    const result = await this.uploadsService.createPresignUrl(user.id, dto);
    return ok(result, 'Upload URL generated');
  }

  @Post('complete')
  async completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteUploadDto,
  ) {
    const result = await this.uploadsService.completeUpload(user.id, dto);
    return ok(result, 'Upload completed');
  }
}
