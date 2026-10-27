import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SCENARIOS, Scenario } from '../model-config';

export class SimulateDto {
  @ApiPropertyOptional({ enum: SCENARIOS, default: 'BASE', description: 'BASE | KERING | BASAH | CUSTOM' })
  @IsOptional()
  @IsIn(SCENARIOS)
  scenario?: Scenario;
}
