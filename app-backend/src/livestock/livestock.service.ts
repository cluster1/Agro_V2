import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';
import { v4 as uuidv4 } from 'uuid';
import { Site } from '../site/entities/site.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Livestock } from './entities/livestock.entity';
import { CreateLivestockDto } from './dto/create-livestock.dto';
import { UpdateLivestockDto } from './dto/update-livestock.dto';

@Injectable()
export class LivestockService {
  constructor(
    @InjectRepository(Livestock)
    private livestockRepository: Repository<Livestock>,
  ) {}

  private async assertParents(tenantId: string, siteId: string, clusterId: string): Promise<void> {
    const { manager } = this.livestockRepository;
    await assertOwned(manager, Site, { site_id: siteId, tenant_id: tenantId }, 'Site');
    // cluster must belong to the same site AND tenant
    await assertOwned(manager, Cluster, { cluster_id: clusterId, site_id: siteId, tenant_id: tenantId }, 'Cluster');
  }

  async create(tenantId: string, createLivestockDto: CreateLivestockDto): Promise<Livestock> {
    await this.assertParents(tenantId, createLivestockDto.site_id, createLivestockDto.cluster_id);

    const livestock = this.livestockRepository.create({
      ...createLivestockDto,
      animal_id: uuidv4(),
      tenant_id: tenantId,
    });

    return await this.livestockRepository.save(livestock);
  }

  async findAll(tenantId: string, clusterId?: string): Promise<Livestock[]> {
    return await this.livestockRepository.find({
      where: clusterId ? { tenant_id: tenantId, cluster_id: clusterId } : { tenant_id: tenantId },
      relations: ['site', 'cluster'],
    });
  }

  async findOne(id: string, scope: string | undefined): Promise<Livestock> {
    const livestock = await this.livestockRepository.findOne({
      where: scoped({ animal_id: id }, scope),
      relations: ['site', 'cluster', 'tenant'],
    });

    if (!livestock) {
      throw new NotFoundException(`Livestock with ID ${id} not found`);
    }

    return livestock;
  }

  async update(id: string, updateLivestockDto: UpdateLivestockDto, scope: string | undefined): Promise<Livestock> {
    const livestock = await this.findOne(id, scope);
    const { tenant_id: _t, animal_id: _a, ...rest } = updateLivestockDto as any;
    if (rest.site_id !== undefined || rest.cluster_id !== undefined) {
      await this.assertParents(
        livestock.tenant_id,
        rest.site_id ?? livestock.site_id,
        rest.cluster_id ?? livestock.cluster_id,
      );
    }
    Object.assign(livestock, rest);
    return await this.livestockRepository.save(livestock);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const livestock = await this.findOne(id, scope);
    await this.livestockRepository.remove(livestock);
  }
}
