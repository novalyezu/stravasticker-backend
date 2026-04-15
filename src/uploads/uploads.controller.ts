import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ok } from '../common/utils/response';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Create a presigned upload URL' })
  @ApiOkResponse({ description: 'Presigned URL and upload metadata' })
  async presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignUploadDto,
  ) {
    const result = await this.uploadsService.createPresignUrl(user.id, dto);
    return ok(result, 'Upload URL generated');
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark upload as completed and persisted' })
  @ApiOkResponse({ description: 'Stored upload payload' })
  async completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteUploadDto,
  ) {
    const result = await this.uploadsService.completeUpload(user.id, dto);
    return ok(result, 'Upload completed');
  }
}
