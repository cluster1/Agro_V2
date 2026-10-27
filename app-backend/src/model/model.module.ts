import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Simulation } from './entities/simulation.entity';
import { SimPhase } from './entities/sim-phase.entity';
import { WeatherDailyRow } from './entities/weather-daily.entity';
import { ClimateNormal } from './entities/climate-normal.entity';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';
import { TwinService } from './twin.service';
import { TwinController } from './twin.controller';
import { CalibrationService } from './calibration.service';
import { AccuracyService } from './accuracy.service';
import { CalibrationController } from './calibration.controller';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { Plant } from '../plant/entities/plant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Simulation, SimPhase, WeatherDailyRow, ClimateNormal, Plant, VarietyPhase])],
  controllers: [ModelController, TwinController, CalibrationController],
  providers: [ModelService, TwinService, CalibrationService, AccuracyService],
  exports: [TypeOrmModule, ModelService],
})
export class ModelModule {}
