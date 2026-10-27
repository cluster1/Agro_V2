import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

export class HarvestFieldsDto {
  @ApiProperty({ example: 6000, description: 'Berat GKP (kg)' })
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  hv_weight: number;

  @ApiProperty({ example: 25, description: 'Kadar air GKP (%), 5-40' })
  @IsNumber()
  hv_moisture: number;

  @ApiPropertyOptional({ example: 1, description: 'Luas dipanen (ha); default luas tanaman' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  hv_area?: number;

  @ApiPropertyOptional({ example: 1.5, description: 'Susut panen (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  hv_loss_pct?: number;

  @ApiPropertyOptional({ example: 6500, description: 'Harga (Rp/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hv_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hv_desc?: string;
}

export class CreateHarvestDto extends HarvestFieldsDto {
  @ApiProperty({ example: 'TENANT1_SITE2_CLS1_PLT1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  plant_id: string;

  @ApiProperty({ example: '2026-12-23' })
  @Matches(DATE_RE, { message: 'hv_date harus berformat YYYY-MM-DD' })
  hv_date: string;

  @ApiPropertyOptional({ description: 'Kegiatan terkait (mis. ubinan) dari tanaman yang sama' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pact_id?: string;
}
