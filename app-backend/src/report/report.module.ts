import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Device } from '../device/entities/device.entity';
import { Tenant } from '../tenant/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Site, Cluster, Device, Tenant])],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
