import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyCalibrationDto {
  @ApiPropertyOptional({ type: [String], description: 'Fase yang diterapkan; kosong = semua fase yang punya usulan' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  phase_ids?: string[];
}
