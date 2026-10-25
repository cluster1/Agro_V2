import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertOwned } from '../common/utils/assert-owned';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { scoped } from '../common/utils/scope';
import { Site } from '../site/entities/site.entity';
import { Cluster } from './entities/cluster.entity';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);

  constructor(
    @InjectRepository(Cluster)
    private clusterRepository: Repository<Cluster>,
  ) {}

  async create(tenantId: string, createClusterDto: CreateClusterDto): Promise<Cluster> {
    try {
      await assertOwned(
        this.clusterRepository.manager,
        Site,
        { site_id: createClusterDto.site_id, tenant_id: tenantId },
        'Site',
      );

      // Generate cluster_id with format site_id_CLS<number>
      const clusterId = await this.generateClusterId(createClusterDto.site_id);
      
      const clusterData = {
        ...createClusterDto,
        cluster_id: clusterId,
        tenant_id: tenantId,
        cluster_created: new Date(),
        cluster_update: new Date(),
      };
      
      const cluster = this.clusterRepository.create(clusterData);
      await this.clusterRepository.insert(cluster);
      
      // Fetch the newly created cluster to return complete data with relations
      const result = await this.clusterRepository.findOne({
        where: { cluster_id: clusterId, site_id: createClusterDto.site_id },
        relations: ['site', 'devices'],
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create cluster: ${error?.message}`);
      throw error;
    }
  }

  private async generateClusterId(siteId: string): Promise<string> {
    // Get the last cluster ID for this site to determine the next number
    // Format: {site_id}_CLS{number}
    const pattern = `${siteId}_CLS%`;
    const lastCluster = await this.clusterRepository
      .createQueryBuilder('cluster')
      .where('cluster.site_id = :siteId', { siteId })
      .andWhere('cluster.cluster_id LIKE :pattern', { pattern })
      .orderBy('cluster.cluster_id', 'DESC')
      .getOne();

    if (!lastCluster) {
      return `${siteId}_CLS1`;
    }

    // Extract number from last cluster ID (e.g., "SITE1_CLS5" -> 5)
    const regex = new RegExp(`${escapeRegExp(siteId)}_CLS(\\d+)`);
    const match = lastCluster.cluster_id.match(regex);
    const lastNumber = match ? parseInt(match[1]) : 0;
    const nextNumber = lastNumber + 1;

    return `${siteId}_CLS${nextNumber}`;
  }

  async findAll(siteId: string, scope: string | undefined): Promise<Cluster[]> {
    return await this.clusterRepository.find({
      where: scoped({ site_id: siteId }, scope),
      relations: ['site', 'devices'],
    });
  }

  async findAllByTenant(tenantId: string): Promise<Cluster[]> {
    return await this.clusterRepository.find({
      where: { tenant_id: tenantId },
      relations: ['site'],
      order: { cluster_name: 'ASC' },
    });
  }

  async findOne(id: string, siteId: string | undefined, scope: string | undefined): Promise<Cluster> {
    const cluster = await this.clusterRepository.findOne({
      where: scoped(siteId ? { cluster_id: id, site_id: siteId } : { cluster_id: id }, scope),
      relations: ['site', 'tenant', 'devices'],
    });

    if (!cluster) {
      throw new NotFoundException(`Cluster with ID ${id} not found`);
    }

    return cluster;
  }

  async update(id: string, updateClusterDto: UpdateClusterDto, scope: string | undefined): Promise<Cluster> {
    const cluster = await this.findOne(id, undefined, scope);

    const { site_id, ...rest } = updateClusterDto;
    if (site_id !== undefined && site_id !== cluster.site_id) {
      await assertOwned(
        this.clusterRepository.manager,
        Site,
        { site_id, tenant_id: cluster.tenant_id },
        'Site',
      );
      cluster.site_id = site_id;
    }
    Object.assign(cluster, rest);
    cluster.cluster_update = new Date();

    return await this.clusterRepository.save(cluster);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const cluster = await this.findOne(id, undefined, scope);
    await this.clusterRepository.remove(cluster);
  }
}
