import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';
import { time } from 'console';

export class UpdateActivityDto {
  @ApiPropertyOptional({
    description: 'Activity date in ISO-8601 format',
    example: '2026-04-15T06:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @ApiPropertyOptional({
    description: 'Distance text shown on sticker',
    example: '10.24 km',
  })
  @IsOptional()
  @IsString()
  distance?: string;

  @ApiPropertyOptional({
    description: 'Pace text shown on sticker',
    example: '5:14 /km',
  })
  @IsOptional()
  @IsString()
  pace?: string;

  @ApiPropertyOptional({
    description: 'Duration text shown on sticker',
    example: '1h 19m',
  })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({
    description: 'Raw stats payload from OCR normalization',
    example: { distance: "10.24 km", pace: '5:14 /km', time: '1h 19m' },
  })
  @IsOptional()
  @IsObject()
  statsJson?: Record<string, unknown>;
}
