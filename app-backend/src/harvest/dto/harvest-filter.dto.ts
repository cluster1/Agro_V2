import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

export class HarvestFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  clusterId?: string;

  @ApiPropertyOptional({ example: 'MT2-2026' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  season?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'from harus berformat YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'to harus berformat YYYY-MM-DD' })
  to?: string;
}
