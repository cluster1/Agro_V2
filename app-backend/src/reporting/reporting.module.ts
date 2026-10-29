import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plant } from '../plant/entities/plant.entity';
import { Harvest } from '../harvest/entities/harvest.entity';
import { Activity } from '../activity/entities/activity.entity';
import { ReportingController } from './reporting.controller';
import { FarmDashboardService } from './farm-dashboard.service';
import { ProductionReportService } from './production-report.service';
import { CostReportService } from './cost-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plant, Harvest, Activity])],
  controllers: [ReportingController],
  providers: [FarmDashboardService, ProductionReportService, CostReportService],
})
export class ReportingModule {}
