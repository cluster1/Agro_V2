import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Harvest } from './entities/harvest.entity';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Harvest])],
  controllers: [HarvestController],
  providers: [HarvestService],
  exports: [TypeOrmModule, HarvestService],
})
export class HarvestModule {}
