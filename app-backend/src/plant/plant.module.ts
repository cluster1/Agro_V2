import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plant } from './entities/plant.entity';
import { Schedule } from '../schedule/entities/schedule.entity';
import { PlantService } from './plant.service';
import { PlantController } from './plant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Plant, Schedule])],
  controllers: [PlantController],
  providers: [PlantService],
  exports: [TypeOrmModule, PlantService],
})
export class PlantModule {}
