import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterService } from './cluster.service';
import { ClusterController } from './cluster.controller';
import { Cluster } from './entities/cluster.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cluster])],
  controllers: [ClusterController],
  providers: [ClusterService],
  exports: [ClusterService],
})
export class ClusterModule {}
