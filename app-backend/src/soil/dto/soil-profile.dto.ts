import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';
import { DRAINAGE, LAND_CLASSES, P_METHODS } from '../soil-rules';

/** Lab result fields shared by create and update. Cross-field rules live in validateSoil. */
export class SoilFieldsDto {
  @ApiPropertyOptional({ example: 'SPL-A-2608' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  soil_sample_code?: string;

  @ApiPropertyOptional({ example: 'Laboratorium tanah mitra' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  soil_lab?: string;

  @ApiPropertyOptional({ example: 'Inceptisol' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  soil_type?: string;

  @ApiPropertyOptional({ example: 'Lempung berliat' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  soil_texture?: string;

  @ApiPropertyOptional({ example: 0, description: 'Kedalaman atas (cm)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  soil_depth_top?: number;

  @ApiPropertyOptional({ example: 20, description: 'Kedalaman bawah (cm)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  soil_depth_bottom?: number;

  @ApiPropertyOptional({ example: 25, description: 'Pasir (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_sand?: number;

  @ApiPropertyOptional({ example: 35, description: 'Debu (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_silt?: number;

  @ApiPropertyOptional({ example: 40, description: 'Liat (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_clay?: number;

  @ApiPropertyOptional({ example: 5.8, description: 'pH H2O' })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  soil_ph_h2o?: number;

  @ApiPropertyOptional({ example: 4.9, description: 'pH KCl' })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  soil_ph_kcl?: number;

  @ApiPropertyOptional({ example: 1.8, description: 'C-organik (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_c_org?: number;

  @ApiPropertyOptional({ example: 0.16, description: 'N total (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_n_total?: number;

  @ApiPropertyOptional({ example: 18, description: 'P tersedia (mg/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  soil_p_avail?: number;

  @ApiPropertyOptional({ example: 0.35, description: 'K dapat tukar (cmol/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  soil_k_exch?: number;

  @ApiPropertyOptional({ example: 6.2, description: 'Ca dapat tukar (cmol/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  soil_ca_exch?: number;

  @ApiPropertyOptional({ example: 1.8, description: 'Mg dapat tukar (cmol/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  soil_mg_exch?: number;

  @ApiPropertyOptional({ example: 22, description: 'KTK (cmol/kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  soil_cec?: number;

  @ApiPropertyOptional({ example: 38, description: 'Kejenuhan basa (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_base_sat?: number;

  @ApiPropertyOptional({ example: 0.25, description: 'EC (dS/m)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  soil_ec?: number;

  @ApiPropertyOptional({ example: 1.25, description: 'Bulk density (g/cm3)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  soil_bulk_density?: number;

  @ApiPropertyOptional({ example: 38, description: 'Kapasitas lapang (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_fc?: number;

  @ApiPropertyOptional({ example: 22, description: 'Titik layu (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  soil_wp?: number;

  @ApiPropertyOptional({ enum: P_METHODS })
  @IsOptional()
  @IsIn(P_METHODS)
  soil_p_method?: string;

  @ApiPropertyOptional({ enum: DRAINAGE })
  @IsOptional()
  @IsIn(DRAINAGE)
  soil_drainage?: string;

  @ApiPropertyOptional({ enum: LAND_CLASSES })
  @IsOptional()
  @IsIn(LAND_CLASSES)
  soil_land_class?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  soil_lon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  soil_lat?: number;

  @ApiPropertyOptional({ description: 'Rujukan laporan lab (nomor/tautan); unggah berkas belum didukung' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  soil_doc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  soil_desc?: string;
}

export class CreateSoilProfileDto extends SoilFieldsDto {
  @ApiProperty({ example: 'TENANT1_SITE2_CLS1', description: 'Petak (cluster) asal sampel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  cluster_id: string;

  @ApiPropertyOptional({ description: 'Tanaman terkait (opsional, dari petak yang sama)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plant_id?: string;

  @ApiProperty({ example: '2026-08-20' })
  @Matches(DATE_RE, { message: 'soil_sample_date harus berformat YYYY-MM-DD' })
  soil_sample_date: string;
}

/** The cluster is fixed; delete and re-enter to move a sample. */
export class UpdateSoilProfileDto extends PartialType(OmitType(CreateSoilProfileDto, ['cluster_id'] as const)) {}
