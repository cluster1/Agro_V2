import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { DATETIME_RE } from '../../schedule/dto/create-schedule.dto';
import { ObservationFieldsDto } from './create-observation.dto';

/** The plant is fixed; a rejected or draft observation is corrected here and re-saved. */
export class UpdateObservationDto extends ObservationFieldsDto {
  @ApiPropertyOptional({ example: '2026-09-28T08:00' })
  @IsOptional()
  @Matches(DATETIME_RE, { message: 'obs_date harus berformat YYYY-MM-DDTHH:mm' })
  obs_date?: string;

  @ApiPropertyOptional({ description: 'true = kembalikan/biarkan sebagai draf; default simpan (status 1)' })
  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}
