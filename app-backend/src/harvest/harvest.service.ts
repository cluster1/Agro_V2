import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Harvest } from './entities/harvest.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Activity } from '../activity/entities/activity.entity';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { HarvestFilterDto } from './dto/harvest-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { scoped } from '../common/utils/scope';
import { daysBetween, parseDay, today } from '../plant/plant-rules';
import { computeHarvest, validateHarvest } from './harvest-rules';

const LIST_LIMIT = 2000;

@Injectable()
export class HarvestService {
  constructor(
    @InjectRepository(Harvest)
    private readonly harvests: Repository<Harvest>,
  ) {}

  private get manager() {
    return this.harvests.manager;
  }

  private assertDate(plant: Plant, day: string): void {
    parseDay(day, 'Tanggal panen');
    if (plant.plant_date && daysBetween(plant.plant_date, day) < 0) {
      throw new BadRequestException('Tanggal panen tidak boleh sebelum tanggal tanam');
    }
    if (day > today()) throw new BadRequestException('Tanggal panen tidak boleh di masa depan');
  }

  private async nextId(plantId: string): Promise<string> {
    const existing = await this.harvests.find({ where: { plant_id: plantId }, select: ['hv_id'] });
    const re = new RegExp(`^${escapeRegExp(plantId)}_HV(\\d+)$`);
    const max = existing.reduce((m, h) => Math.max(m, Number(re.exec(h.hv_id)?.[1] ?? 0)), 0);
    return `${plantId}_HV${max + 1}`;
  }

  /** `dryRun` runs every rule and returns the would-be row without writing (used by import preview). */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateHarvestDto,
    opts: { source?: string; dryRun?: boolean } = {},
  ): Promise<Harvest> {
    const plant = await assertOwned(this.manager, Plant, { plant_id: dto.plant_id, tenant_id: tenantId }, 'Tanaman');
    this.assertDate(plant, dto.hv_date);

    const area = dto.hv_area ?? plant.plant_area;
    if (!area) throw new BadRequestException('Luas dipanen wajib diisi (luas tanaman belum ada)');
    validateHarvest({ weight: dto.hv_weight, moisture: dto.hv_moisture, area, plantArea: plant.plant_area });

    if (dto.pact_id) {
      await assertOwned(
        this.manager,
        Activity,
        { pact_id: dto.pact_id, tenant_id: tenantId, plant_id: plant.plant_id },
        'Kegiatan',
      );
    }

    const existing = await this.harvests.find({ where: { plant_id: plant.plant_id }, select: ['hv_id'] });
    const now = new Date();
    const row = this.harvests.create({
      hv_id: await this.nextId(plant.plant_id),
      tenant_id: tenantId,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      pact_id: dto.pact_id,
      user_id: userId,
      hv_date: dto.hv_date,
      hv_season: plant.plant_season,
      hv_rotation: existing.length + 1,
      hv_area: area,
      hv_weight: dto.hv_weight,
      hv_moisture: dto.hv_moisture,
      ...computeHarvest(dto.hv_weight, dto.hv_moisture, area),
      hv_loss_pct: dto.hv_loss_pct,
      hv_price: dto.hv_price,
      hv_source: opts.source ?? 'WEB',
      hv_desc: dto.hv_desc,
      hv_sts: 1,
      hv_created: now,
      hv_update: now,
    });
    if (!opts.dryRun) await this.harvests.insert(row);
    return row;
  }

  async findAll(scope: string | undefined, filters: HarvestFilterDto = {}): Promise<Harvest[]> {
    const where: Record<string, unknown> = {};
    if (filters.plantId) where.plant_id = filters.plantId;
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.season) where.hv_season = filters.season;
    if (filters.from && filters.to) where.hv_date = Between(filters.from, filters.to);
    else if (filters.from) where.hv_date = MoreThanOrEqual(filters.from);
    else if (filters.to) where.hv_date = LessThanOrEqual(filters.to);
    return this.harvests.find({ where: scoped(where, scope), order: { hv_date: 'DESC' }, take: LIST_LIMIT });
  }

  async findOne(id: string, scope: string | undefined): Promise<Harvest> {
    const row = await this.harvests.findOne({ where: scoped({ hv_id: id }, scope) });
    if (!row) throw new NotFoundException(`Panen ${id} tidak ditemukan`);
    return row;
  }

  async update(id: string, scope: string | undefined, dto: UpdateHarvestDto): Promise<Harvest> {
    const row = await this.findOne(id, scope);
    const plant = await this.manager.getRepository(Plant).findOne({ where: { plant_id: row.plant_id } });
    if (!plant) throw new NotFoundException('Tanaman tidak ditemukan');

    const { hv_date, ...rest } = dto;
    Object.assign(row, rest);
    if (hv_date !== undefined) {
      this.assertDate(plant, hv_date);
      row.hv_date = hv_date;
    }
    validateHarvest({ weight: row.hv_weight, moisture: row.hv_moisture, area: row.hv_area, plantArea: plant.plant_area });
    Object.assign(row, computeHarvest(row.hv_weight, row.hv_moisture, row.hv_area));
    row.hv_update = new Date();
    return this.harvests.save(row);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const row = await this.findOne(id, scope);
    await this.harvests.delete({ hv_id: row.hv_id });
  }
}
