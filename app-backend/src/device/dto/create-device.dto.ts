import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'IoT Node 1' })
  @IsString()
  @IsNotEmpty()
  dev_name: string;

  @ApiProperty({ example: 'site-123' })
  @IsString()
  @IsNotEmpty()
  site_id: string;

  @ApiProperty({ example: 'cluster-456' })
  @IsString()
  @IsOptional()
  cluster_id?: string;

  @ApiProperty({ example: 'token-abc123xyz' })
  @IsString()
  @IsOptional()
  dev_token?: string;

  @ApiProperty({ example: 'Corner A, Kandang 1' })
  @IsString()
  @IsOptional()
  dev_location?: string;

  @ApiProperty({ example: 106.8456 })
  @IsNumber()
  @IsOptional()
  dev_lon?: number;

  @ApiProperty({ example: -6.2088 })
  @IsNumber()
  @IsOptional()
  dev_lat?: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @IsOptional()
  dev_alt?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dev_number_id?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dev_ip?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dev_port?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dev_img?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsOptional()
  dev_sts?: number;
}
