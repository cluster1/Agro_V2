import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';
import { DATETIME_RE, REPEATS } from './create-schedule.dto';

/** The plant is fixed once a schedule exists; move a task by editing its dates, not its plant. */
export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  actype_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sched_title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sched_desc?: string;

  @ApiPropertyOptional({ example: '2026-09-29T08:00' })
  @IsOptional()
  @Matches(DATETIME_RE, { message: 'sched_start_date harus berformat YYYY-MM-DDTHH:mm' })
  sched_start_date?: string;

  @ApiPropertyOptional({ example: '2026-09-29T17:00' })
  @IsOptional()
  @Matches(DATETIME_RE, { message: 'sched_end_date harus berformat YYYY-MM-DDTHH:mm' })
  sched_end_date?: string;

  @ApiPropertyOptional({ enum: REPEATS })
  @IsOptional()
  @IsIn(REPEATS)
  sched_repeat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  sched_interval?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DATE_RE, { message: 'sched_repeat_until harus berformat YYYY-MM-DD' })
  sched_repeat_until?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sched_plan_value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  sched_remind?: number;

  @ApiPropertyOptional({ description: 'Hanya 3 (batalkan); status selesai diisi otomatis oleh kegiatan', enum: [3] })
  @IsOptional()
  @IsInt()
  @IsIn([3])
  sched_sts?: number;
}
