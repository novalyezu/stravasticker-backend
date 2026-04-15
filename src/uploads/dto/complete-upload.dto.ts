import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class CompleteUploadDto {
  @ApiProperty({
    description: 'Storage key returned by presign endpoint',
    example: 'uploads/01JS0H8TSZZ5W5H26K88V1X71D.png',
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: 'Original file name from the client',
    example: 'run-sticker-2026-04-15.png',
  })
  @IsString()
  fileName!: string;

  @ApiProperty({
    description: 'MIME type of the uploaded file',
    example: 'image/png',
  })
  @IsString()
  mimeType!: string;

  @ApiProperty({
    description: 'File size in bytes',
    minimum: 1,
    maximum: 5 * 1024 * 1024,
    example: 325412,
  })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSize!: number;
}
