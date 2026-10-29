import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Batasi ke satu site' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  siteId?: string;
}

export class ProductionQueryDto {
  @ApiPropertyOptional({ description: 'Filter site' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter musim, mis. MT2-2026' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  season?: string;

  @ApiPropertyOptional({ description: 'Filter varietas' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  varId?: string;

  @ApiPropertyOptional({ enum: ['json', 'xlsx', 'pdf'], description: 'xlsx / pdf untuk unduhan' })
  @IsOptional()
  @IsIn(['json', 'xlsx', 'pdf'])
  format?: 'json' | 'xlsx' | 'pdf';
}

export class CostQueryDto {
  @ApiPropertyOptional({ description: 'Filter site' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter petak' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plantId?: string;

  @ApiPropertyOptional({ description: 'Mulai (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DAY, { message: 'from harus berformat YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ description: 'Sampai (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DAY, { message: 'to harus berformat YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ enum: ['json', 'xlsx'], description: 'xlsx untuk unduhan Excel' })
  @IsOptional()
  @IsIn(['json', 'xlsx'])
  format?: 'json' | 'xlsx';
}
