import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMediaDto {
  @ApiProperty({ example: 'site-123' })
  @IsString()
  @IsNotEmpty()
  site_id: string;

  @ApiProperty({ example: 'cluster-456', required: false })
  @IsString()
  @IsOptional()
  cluster_id?: string;

  @ApiProperty({ example: 'photo' })
  @IsString()
  @IsOptional()
  media_type?: string;

  @ApiProperty({ example: 'Kondisi lahan pagi hari' })
  @IsString()
  @IsOptional()
  media_desc?: string;
}
