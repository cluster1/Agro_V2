import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlantType } from './entities/plant-type.entity';
import { PlantPhase } from './entities/plant-phase.entity';
import { PlantVariety } from './entities/plant-variety.entity';
import { VarietyPhase } from './entities/variety-phase.entity';
import { PhaseParam } from './entities/phase-param.entity';
import { ActivityType } from './entities/activity-type.entity';
import { Material } from './entities/material.entity';
import { TelemetryCode } from './entities/telemetry-code.entity';
import { Unit } from '../unit/entities/unit.entity';
import { RefService } from './ref.service';
import { RefController } from './ref.controller';

const ENTITIES = [
  PlantType,
  PlantPhase,
  PlantVariety,
  VarietyPhase,
  PhaseParam,
  ActivityType,
  Material,
  TelemetryCode,
  Unit,
];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [RefController],
  providers: [RefService],
  exports: [TypeOrmModule, RefService],
})
export class RefModule {}
