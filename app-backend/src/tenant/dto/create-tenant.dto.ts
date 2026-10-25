import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsIn } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ 
    example: 'PT Agro Sejahtera',
    description: 'Nama tenant (wajib diisi)'
  })
  @IsString()
  @IsNotEmpty()
  tenant_name: string;

  @ApiProperty({ 
    example: 'perusahaan',
    description: 'Tipe tenant: perusahaan, koperasi, system, dll (opsional)',
    required: false
  })
  @IsString()
  @IsOptional()
  tenant_type?: string;

  @ApiProperty({ 
    example: 'Jl. Pertanian No. 123, Jakarta Selatan',
    description: 'Alamat lengkap tenant (opsional)',
    required: false
  })
  @IsString()
  @IsOptional()
  tenant_address?: string;

  @ApiProperty({ 
    example: '+628123456789',
    description: 'Nomor kontak tenant (opsional)',
    required: false
  })
  @IsString()
  @IsOptional()
  tenant_contact?: string;

  @ApiProperty({ 
    example: 'John Doe',
    description: 'Nama Person In Charge (PIC) tenant (opsional)',
    required: false
  })
  @IsString()
  @IsOptional()
  tenant_pic?: string;

  @ApiProperty({ 
    example: 'uploads/logos/tenant-logo.png',
    description: 'Path file logo tenant (opsional)',
    required: false
  })
  @IsString()
  @IsOptional()
  tenant_logo?: string;

  @ApiProperty({ 
    example: 1,
    description: 'Status tenant: 1 = Active, 0 = Non-Active (default: 1)',
    required: false
  })
  @IsNumber()
  @IsIn([0, 1])
  @IsOptional()
  tenant_sts?: number;
}
