import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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

export class CreateActivityDto {
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

  @ApiProperty({ example: '2026-09-29T09:00', description: 'Waktu kegiatan dilakukan' })
  @Matches(DATETIME_RE, { message: 'pact_date harus berformat YYYY-MM-DDTHH:mm' })
  pact_date: string;

  @ApiPropertyOptional({ example: 'TENANT1_SITE2_CLS1_PLT1_SCH2', description: 'Jadwal yang direalisasikan; jadwal menjadi selesai' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sched_id?: string;

  @ApiPropertyOptional({ example: '150', description: 'Nilai/jumlah (wajib numerik untuk pemupukan dan proteksi)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pact_value?: string;

  @ApiPropertyOptional({ example: 'UNIT-KG', description: 'Default: satuan jenis kegiatan' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit_id?: string;

  @ApiPropertyOptional({ example: 'MAT-UREA', description: 'Wajib untuk kategori PEMUPUKAN dan PROTEKSI' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mat_id?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  pact_worker?: number;

  @ApiPropertyOptional({ example: 450000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pact_cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pact_lon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pact_lat?: number;

  @ApiPropertyOptional({ example: 'Sebar rata' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pact_desc?: string;

  @ApiPropertyOptional({
    description: 'ID media yang sudah diunggah (POST /media); wajib bila jenis kegiatan mewajibkan foto',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  media_ids?: string[];
}
