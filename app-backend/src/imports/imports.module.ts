import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plant } from '../plant/entities/plant.entity';
import { HarvestModule } from '../harvest/harvest.module';
import { ObservationModule } from '../observation/observation.module';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Plant]), HarvestModule, ObservationModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
