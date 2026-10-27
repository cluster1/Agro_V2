import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DATETIME_RE } from '../../schedule/dto/create-schedule.dto';
import { SYMPTOM_CODES } from '../observation-rules';

/** Measurement fields shared by create and update. Ranges are enforced by validateMeasurements. */
export class ObservationFieldsDto {
  @ApiPropertyOptional({ example: 20, description: 'Jumlah rumpun sampel (default 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  obs_sample_n?: number;

  @ApiPropertyOptional({ example: 32, description: 'Tinggi rata-rata (cm), 5-160' })
  @IsOptional()
  @IsNumber()
  obs_height?: number;

  @ApiPropertyOptional({ example: 8, description: 'Anakan per rumpun, 1-60' })
  @IsOptional()
  @IsNumber()
  obs_tiller?: number;

  @ApiPropertyOptional({ example: 3.5, description: 'BWD 2-5 kelipatan 0,5; HST 14-62' })
  @IsOptional()
  @IsNumber()
  obs_bwd?: number;

  @ApiPropertyOptional({ description: 'Malai per rumpun; mulai berbunga' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  obs_panicle?: number;

  @ApiPropertyOptional({ description: 'Gabah per malai; masak susu s.d. masak penuh' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  obs_grain?: number;

  @ApiPropertyOptional({ description: '% gabah isi, 0-100' })
  @IsOptional()
  @IsNumber()
  obs_filled_pct?: number;

  @ApiPropertyOptional({ example: 50, description: '% populasi yang mencapai fase, 0-100' })
  @IsOptional()
  @IsNumber()
  obs_phase_pct?: number;

  @ApiPropertyOptional({ example: 'Wereng coklat' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  obs_pest_name?: string;

  @ApiPropertyOptional({ example: 10, description: 'Intensitas hama 0-100' })
  @IsOptional()
  @IsNumber()
  obs_pest_pct?: number;

  @ApiPropertyOptional({ enum: SYMPTOM_CODES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SYMPTOM_CODES.length)
  @IsIn(SYMPTOM_CODES, { each: true })
  obs_symptom?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  obs_lon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  obs_lat?: number;

  @ApiPropertyOptional({ example: 'Anakan aktif tercapai 50% rumpun' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  obs_desc?: string;
}

export class CreateObservationDto extends ObservationFieldsDto {
  @ApiProperty({ example: 'TENANT1_SITE2_CLS1_PLT1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plant_id: string;

  @ApiProperty({ example: '2026-09-28T08:00' })
  @Matches(DATETIME_RE, { message: 'obs_date harus berformat YYYY-MM-DDTHH:mm' })
  obs_date: string;

  @ApiPropertyOptional({ description: 'true = simpan sebagai draf (status 0); default langsung tersimpan (status 1)' })
  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'ID media yang sudah diunggah' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  media_ids?: string[];
}
