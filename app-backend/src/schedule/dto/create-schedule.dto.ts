import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, Max } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

export const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
export const REPEATS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

export class CreateScheduleDto {
  @ApiProperty({ example: 'TENANT1_SITE2_CLS1_PLT1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plant_id: string;

  @ApiProperty({ example: 'ACT-PD-PUPUK-S1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  actype_id: string;

  @ApiPropertyOptional({ example: 'Pemupukan Susulan I', description: 'Default: nama jenis kegiatan' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sched_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sched_desc?: string;

  @ApiProperty({ example: '2026-09-29T08:00' })
  @Matches(DATETIME_RE, { message: 'sched_start_date harus berformat YYYY-MM-DDTHH:mm' })
  sched_start_date: string;

  @ApiProperty({ example: '2026-09-29T17:00' })
  @Matches(DATETIME_RE, { message: 'sched_end_date harus berformat YYYY-MM-DDTHH:mm' })
  sched_end_date: string;

  @ApiPropertyOptional({ enum: REPEATS, default: 'NONE' })
  @IsOptional()
  @IsIn(REPEATS)
  sched_repeat?: string;

  @ApiPropertyOptional({ example: 1, description: 'Kelipatan perulangan (>= 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  sched_interval?: number;

  @ApiPropertyOptional({ example: '2026-11-16' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'sched_repeat_until harus berformat YYYY-MM-DD' })
  sched_repeat_until?: string;

  @ApiPropertyOptional({ example: '50', description: 'Nilai rencana, mis. dosis' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sched_plan_value?: string;

  @ApiPropertyOptional({ example: 'UNIT-KG', description: 'Default: satuan jenis kegiatan' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit_id?: string;

  @ApiPropertyOptional({ example: 24, description: 'Pengingat (jam sebelum mulai)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  sched_remind?: number;
}
