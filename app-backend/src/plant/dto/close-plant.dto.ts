import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { DATE_RE } from '../plant-rules';

export class ClosePlantDto {
  @ApiPropertyOptional({ example: '2026-12-20', description: 'Tanggal panen/penutupan; default hari ini' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'plant_harvest_date harus berformat YYYY-MM-DD' })
  plant_harvest_date?: string;
}
