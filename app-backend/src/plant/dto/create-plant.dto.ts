import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_RE, SEASON_RE } from '../plant-rules';

export class CreatePlantDto {
  @ApiProperty({ example: 'TENANT1_SITE2_CLS1', description: 'Petak (cluster); satu tanaman padi aktif per musim' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  cluster_id: string;

  @ApiPropertyOptional({ example: 'VAR-PD-INPARI32', description: 'Default VAR-PD-DEFAULT bila tidak diketahui' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  var_id?: string;

  @ApiProperty({ example: 'MT2-2026', description: 'Format MT{1-3}-{tahun}' })
  @Matches(SEASON_RE, { message: 'plant_season harus berformat MT{1-3}-{tahun}, mis. MT2-2026' })
  plant_season: string;

  @ApiProperty({ example: '2026-08-25' })
  @Matches(DATE_RE, { message: 'plant_sow_date harus berformat YYYY-MM-DD' })
  plant_sow_date: string;

  @ApiProperty({ example: '2026-09-15', description: '>= tanggal sebar' })
  @Matches(DATE_RE, { message: 'plant_date harus berformat YYYY-MM-DD' })
  plant_date: string;

  @ApiProperty({ example: 2, description: 'Luas (ha)' })
  @IsNumber()
  @Min(0.0001)
  @Max(100000)
  plant_area: number;

  @ApiPropertyOptional({ example: 426666, description: 'Populasi (rumpun); default luas x kepadatan standar' })
  @IsOptional()
  @IsInt()
  @Min(1)
  plant_count?: number;

  @ApiPropertyOptional({ description: 'GeoJSON Polygon batas petak' })
  @IsOptional()
  @IsObject()
  plant_geom?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['AUTO', 'MANUAL'], default: 'AUTO' })
  @IsOptional()
  @IsIn(['AUTO', 'MANUAL'])
  plant_phase_mode?: string;

  @ApiPropertyOptional({ example: 'A-MT2-2026' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_tag?: string;

  @ApiPropertyOptional({ example: 'Padi Petak A MT2 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  plant_seed_source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  plant_desc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  plant_lon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  plant_lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plant_alt?: number;
}
