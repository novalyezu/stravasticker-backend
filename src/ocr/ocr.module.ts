import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsModule } from '../uploads/uploads.module';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [OcrController],
  providers: [OcrService, JwtAuthGuard],
})
export class OcrModule {}
