import { IsString } from 'class-validator';

export class ExtractOcrDto {
  @IsString()
  uploadId!: string;
}
