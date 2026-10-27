import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectObservationDto {
  @ApiProperty({ example: 'Foto tidak sesuai dengan nilai BWD', description: 'Alasan penolakan (wajib)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}
