import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Optional filters; each resource honours only the ones it declares (see REF_RESOURCES). */
export class RefQueryDto {
  @ApiPropertyOptional({ example: 'PT-PADI' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ptype_id?: string;

  @ApiPropertyOptional({ example: 'VAR-PD-INPARI32' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  var_id?: string;

  @ApiPropertyOptional({ example: 'PH-PADI-05' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phase_id?: string;

  @ApiPropertyOptional({ example: 'TEMP' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  kt_id?: string;

  @ApiPropertyOptional({ example: 'PEMUPUKAN' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;
}
