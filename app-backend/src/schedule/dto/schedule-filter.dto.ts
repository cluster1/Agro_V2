import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

export class ScheduleFilterDto {
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

  @ApiPropertyOptional({ description: '0 rencana, 2 selesai, 3 batal, 4 terlambat', enum: [0, 2, 3, 4] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 2, 3, 4])
  status?: number;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Mulai >= tanggal ini' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'from harus berformat YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Mulai <= tanggal ini' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'to harus berformat YYYY-MM-DD' })
  to?: string;
}
