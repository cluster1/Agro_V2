import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';
import { DATE_RE } from '../../plant/plant-rules';

/** Any harvest field may be corrected; derived values are recomputed. The plant is fixed. */
export class UpdateHarvestDto {
  @ApiPropertyOptional({ example: '2026-12-23' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'hv_date harus berformat YYYY-MM-DD' })
  hv_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100_000_000)
  hv_weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hv_moisture?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  hv_area?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  hv_loss_pct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hv_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  hv_desc?: string;
}
