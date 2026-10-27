import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_RE } from '../plant-rules';

/**
 * Cluster, variety, season and dates are fixed once a plant exists (they shaped its template
 * schedule); to change them close the season and start a new plant.
 */
export class UpdatePlantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  plant_desc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_seed_source?: string;

  @ApiPropertyOptional({ description: 'Luas (ha)' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Max(100000)
  plant_area?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  plant_count?: number;

  @ApiPropertyOptional({ description: 'GeoJSON Polygon batas petak' })
  @IsOptional()
  @IsObject()
  plant_geom?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['AUTO', 'MANUAL'] })
  @IsOptional()
  @IsIn(['AUTO', 'MANUAL'])
  plant_phase_mode?: string;

  @ApiPropertyOptional({ description: 'Fase manual; hanya bila mode MANUAL' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phase_id?: string;

  @ApiPropertyOptional({ example: '2026-10-19', description: 'Tanggal fase manual' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'plant_phase_date harus berformat YYYY-MM-DD' })
  plant_phase_date?: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  plant_health?: string;
}
