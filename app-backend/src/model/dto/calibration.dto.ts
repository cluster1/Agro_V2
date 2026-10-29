import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyCalibrationDto {
  @ApiPropertyOptional({ type: [String], description: 'Fase yang diterapkan; kosong = semua fase yang punya usulan' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  phase_ids?: string[];
}

export class AccuracyQueryDto {
  @ApiPropertyOptional({ description: 'Filter varietas' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  varId?: string;

  @ApiPropertyOptional({ description: 'Filter musim, mis. MT2-2026' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  season?: string;

  @ApiPropertyOptional({ enum: ['json', 'xlsx'], description: 'xlsx untuk unduhan Excel' })
  @IsOptional()
  @IsIn(['json', 'xlsx'])
  format?: 'json' | 'xlsx';
}
