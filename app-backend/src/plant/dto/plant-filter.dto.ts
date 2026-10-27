import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class PlantFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  clusterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  siteId?: string;

  @ApiPropertyOptional({ example: 'MT2-2026' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  season?: string;

  @ApiPropertyOptional({ description: '1 aktif, 0 ditutup', enum: [0, 1] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  status?: number;
}
