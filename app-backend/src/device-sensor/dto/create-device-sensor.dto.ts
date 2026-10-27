import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsInt } from 'class-validator';

export class CreateDeviceSensorDto {
  @ApiProperty({ 
    example: 'PARAM001',
    description: 'Parameter ID (user-defined)'
  })
  @IsString()
  @IsNotEmpty()
  ds_id: string;

  @ApiProperty({ 
    example: 'Temperature Sensor',
    description: 'Device sensor name'
  })
  @IsString()
  @IsNotEmpty()
  ds_name: string;

  @ApiProperty({ 
    example: '0x01',
    description: 'Sensor address',
    required: false
  })
  @IsString()
  @IsOptional()
  ds_address?: string;

  @ApiProperty({ 
    example: 1,
    description: 'Sensor sequence number',
    required: false
  })
  @IsInt()
  @IsOptional()
  ds_seq?: number;

  @ApiProperty({ 
    example: 25.5,
    description: 'Normal value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  dc_normal_value?: number;

  @ApiProperty({ 
    example: 20,
    description: 'Minimum normal value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_min_norm_value?: number;

  @ApiProperty({ 
    example: 30,
    description: 'Maximum normal value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_max_norm_value?: number;

  @ApiProperty({ 
    example: 0,
    description: 'Minimum sensor value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_min_value?: number;

  @ApiProperty({ 
    example: 100,
    description: 'Maximum sensor value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_max_value?: number;

  @ApiProperty({ 
    example: 15,
    description: 'Minimum warning value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_min_val_warn?: number;

  @ApiProperty({ 
    example: 35,
    description: 'Maximum warning value',
    required: false
  })
  @IsNumber()
  @IsOptional()
  ds_max_val_warn?: number;

  @ApiProperty({ 
    example: 1,
    description: 'Status (1=active, 0=inactive)',
    required: false
  })
  @IsInt()
  @IsOptional()
  ds_sts?: number;

  @ApiProperty({ 
    example: 'UNIT001',
    description: 'Unit ID',
    required: false
  })
  @IsString()
  @IsOptional()
  unit_id?: string;

  @ApiProperty({ 
    example: 'CLUSTER001',
    description: 'Cluster ID',
    required: false
  })
  @IsString()
  @IsOptional()
  cluster_id?: string;

}
