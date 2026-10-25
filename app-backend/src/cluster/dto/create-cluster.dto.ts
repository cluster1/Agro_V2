import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateClusterDto {
  @ApiProperty({ example: 'site-123' })
  @IsString()
  @IsNotEmpty()
  site_id: string;

  @ApiProperty({ example: 'Kandang Ayam A' })
  @IsString()
  @IsNotEmpty()
  cluster_name: string;

  @ApiProperty({ example: 'HOUSE' })
  @IsString()
  @IsOptional()
  cluster_type?: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsOptional()
  cluster_capacity?: number;

  @ApiProperty({ example: 800 })
  @IsNumber()
  @IsOptional()
  cluster_current?: number;

  @ApiProperty({ example: 'Kandang layer phase 1' })
  @IsString()
  @IsOptional()
  cluster_desc?: string;
}
