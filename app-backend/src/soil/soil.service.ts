import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SoilProfile } from './entities/soil-profile.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { Plant } from '../plant/entities/plant.entity';
import { CreateSoilProfileDto, UpdateSoilProfileDto } from './dto/soil-profile.dto';
import { SoilFilterDto } from './dto/soil-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';
import { parseDay, today } from '../plant/plant-rules';
import { NutrientStatuses, nutrientStatus, validateSoil } from './soil-rules';

const LIST_LIMIT = 2000;

export type SoilProfileView = SoilProfile & NutrientStatuses;

const view = (row: SoilProfile): SoilProfileView => ({ ...row, ...nutrientStatus(row) });

@Injectable()
export class SoilService {
  constructor(
    @InjectRepository(SoilProfile)
    private readonly profiles: Repository<SoilProfile>,
  ) {}

  private get manager() {
    return this.profiles.manager;
  }

  private assertDate(day: string): void {
    parseDay(day, 'Tanggal sampling');
    if (day > today()) throw new BadRequestException('Tanggal sampling tidak boleh di masa depan');
  }

  async create(tenantId: string, userId: string, dto: CreateSoilProfileDto): Promise<SoilProfileView> {
    const cluster = await assertOwned(this.manager, Cluster, { cluster_id: dto.cluster_id, tenant_id: tenantId }, 'Petak');
    if (dto.plant_id) {
      await assertOwned(
        this.manager,
        Plant,
        { plant_id: dto.plant_id, tenant_id: tenantId, cluster_id: cluster.cluster_id },
        'Tanaman',
      );
    }
    this.assertDate(dto.soil_sample_date);
    validateSoil(dto);

    const now = new Date();
    // 32-char UUID without dashes (FSD: new IDs are UUIDs, not max+1)
    const { cluster_id: _c, plant_id, ...fields } = dto;
    const row = this.profiles.create({
      ...fields,
      soil_id: uuidv4().replace(/-/g, ''),
      tenant_id: tenantId,
      site_id: cluster.site_id,
      cluster_id: cluster.cluster_id,
      plant_id,
      user_id: userId,
      soil_sts: 1,
      soil_created: now,
      soil_update: now,
    });
    await this.profiles.insert(row);
    return view(row);
  }

  async findAll(scope: string | undefined, filters: SoilFilterDto = {}): Promise<SoilProfileView[]> {
    const where: Record<string, unknown> = {};
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.plantId) where.plant_id = filters.plantId;
    const rows = await this.profiles.find({
      where: scoped(where, scope),
      order: { soil_sample_date: 'DESC' },
      take: LIST_LIMIT,
    });
    return rows.map(view);
  }

  async findOne(id: string, scope: string | undefined): Promise<SoilProfileView> {
    const row = await this.profiles.findOne({ where: scoped({ soil_id: id }, scope) });
    if (!row) throw new NotFoundException(`Profil tanah ${id} tidak ditemukan`);
    return view(row);
  }

  async update(id: string, scope: string | undefined, dto: UpdateSoilProfileDto): Promise<SoilProfileView> {
    const found = await this.profiles.findOne({ where: scoped({ soil_id: id }, scope) });
    if (!found) throw new NotFoundException(`Profil tanah ${id} tidak ditemukan`);

    const { plant_id, soil_sample_date, ...rest } = dto;
    Object.assign(found, rest);
    if (soil_sample_date !== undefined) {
      this.assertDate(soil_sample_date);
      found.soil_sample_date = soil_sample_date;
    }
    if (plant_id !== undefined) {
      if (plant_id) {
        await assertOwned(
          this.manager,
          Plant,
          { plant_id, tenant_id: found.tenant_id, cluster_id: found.cluster_id },
          'Tanaman',
        );
      }
      found.plant_id = plant_id || (null as unknown as string);
    }

    validateSoil(found);
    found.soil_update = new Date();
    return view(await this.profiles.save(found));
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const row = await this.profiles.findOne({ where: scoped({ soil_id: id }, scope) });
    if (!row) throw new NotFoundException(`Profil tanah ${id} tidak ditemukan`);
    await this.profiles.delete({ soil_id: row.soil_id });
  }
}
