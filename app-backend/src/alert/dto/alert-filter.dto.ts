import { Type } from 'class-transformer';
import { IsOptional, IsString, IsDateString, IsInt, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AlertFilterDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Filter by cluster ID' })
  @IsOptional()
  @IsString()
  clusterId?: string;

  @ApiPropertyOptional({ description: 'Filter by device ID' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Filter by handling status: 0 baru, 1 dilihat, 2 selesai', enum: [0, 1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  status?: number;

  @ApiPropertyOptional({ description: 'Filter by alarm code (e.g. ALARM-HIGH)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional({ description: 'Filter by alarm start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by alarm end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
