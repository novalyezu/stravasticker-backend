import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ExtractOcrDto {
  @ApiProperty({
    description: 'Upload ID returned after upload completion',
    example: '01JS0H9HG8MKN6AZBQ9MMYF2Y9',
  })
  @IsString()
  uploadId!: string;
}
