import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlertDto {
  @ApiProperty({ example: 2, description: 'Status penanganan: 1 = dilihat, 2 = selesai', enum: [1, 2] })
  @IsInt()
  @IsIn([1, 2])
  alm_sts: number;

  @ApiPropertyOptional({ example: 'Pompa sudah dinyalakan', description: 'Catatan penanganan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alm_note?: string;
}
