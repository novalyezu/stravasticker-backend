import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsString()
  distance?: string;

  @IsOptional()
  @IsString()
  pace?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsObject()
  statsJson?: Record<string, unknown>;
}
