import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLivestockDto {
  @ApiProperty({ example: 'site-123' })
  @IsString()
  @IsNotEmpty()
  site_id: string;

  @ApiProperty({ example: 'cluster-456' })
  @IsString()
  @IsNotEmpty()
  cluster_id: string;

  @ApiProperty({ example: 'TAG-001' })
  @IsString()
  @IsOptional()
  animal_tag?: string;

  @ApiProperty({ example: 'Ayam' })
  @IsString()
  @IsOptional()
  animal_species?: string;

  @ApiProperty({ example: 'Leghorn' })
  @IsString()
  @IsOptional()
  animal_breed?: string;

  @ApiProperty({ example: 'F' })
  @IsString()
  @IsOptional()
  animal_gender?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  animal_birthdate?: Date;

  @ApiProperty({ example: 'aktif' })
  @IsString()
  @IsOptional()
  animal_status?: string;
}
