import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

export class ObservationFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  plantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  clusterId?: string;

  @ApiPropertyOptional({ description: '0 draf, 1 tersimpan, 2 terverifikasi, 3 ditolak', enum: [0, 1, 2, 3] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2, 3])
  status?: number;

  @ApiPropertyOptional({ enum: ['WEB', 'FIELDKIT', 'API', 'AI', 'IMPORT'] })
  @IsOptional()
  @IsIn(['WEB', 'FIELDKIT', 'API', 'AI', 'IMPORT'])
  source?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'from harus berformat YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'to harus berformat YYYY-MM-DD' })
  to?: string;
}
