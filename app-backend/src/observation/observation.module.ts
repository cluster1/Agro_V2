import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Observation } from './entities/observation.entity';
import { ObservationService } from './observation.service';
import { ObservationController } from './observation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Observation])],
  controllers: [ObservationController],
  providers: [ObservationService],
  exports: [TypeOrmModule, ObservationService],
})
export class ObservationModule {}
