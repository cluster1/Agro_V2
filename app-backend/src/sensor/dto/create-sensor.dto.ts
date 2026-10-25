import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSensorDto {
  @ApiProperty({ example: 'SENSOR_001', description: 'Manual sensor ID' })
  @IsString()
  @IsNotEmpty()
  sens_id: string;

  @ApiProperty({ example: 'device-123' })
  @IsString()
  @IsNotEmpty()
  dev_id: string;

  @ApiProperty({ example: 'Temperature Sensor 1' })
  @IsString()
  @IsNotEmpty()
  sens_name: string;

  @ApiProperty({ example: 'Inside kandang corner A' })
  @IsString()
  @IsOptional()
  sens_location?: string;

  @ApiProperty({ example: -6.2088 })
  @IsNumber()
  @IsOptional()
  sens_lat?: number;

  @ApiProperty({ example: 106.8456 })
  @IsNumber()
  @IsOptional()
  sens_lon?: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @IsOptional()
  sens_alt?: number;

  @ApiProperty({ example: 0, description: 'Display sequence order' })
  @IsNumber()
  @IsOptional()
  sens_seq?: number;
}
