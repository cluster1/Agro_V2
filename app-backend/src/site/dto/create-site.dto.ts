import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'Lahan Padi Sawah 1' })
  @IsString()
  @IsNotEmpty()
  site_name: string;

  @ApiProperty({ example: 'FARM' })
  @IsString()
  @IsOptional()
  site_type?: string;

  @ApiProperty({ example: 'Desa Sukamaju' })
  @IsString()
  @IsOptional()
  site_address?: string;

  @ApiProperty({ example: 106.8456 })
  @IsNumber()
  @IsOptional()
  site_lon?: number;

  @ApiProperty({ example: -6.2088 })
  @IsNumber()
  @IsOptional()
  site_lat?: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @IsOptional()
  site_alt?: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  site_sts?: number;
}
