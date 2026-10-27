import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Plant } from './entities/plant.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { Cluster } from '../cluster/entities/cluster.entity';
import { PlantType } from '../ref/entities/plant-type.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { PlantVariety } from '../ref/entities/plant-variety.entity';
import { VarietyPhase } from '../ref/entities/variety-phase.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { ClosePlantDto } from './dto/close-plant.dto';
import { PlantFilterDto } from './dto/plant-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { scoped } from '../common/utils/scope';
import { buildTemplateSchedules } from '../schedule/schedule-template';
import { areaWarning, daysBetween, parseDay, phaseForAge, today } from './plant-rules';

/** Only rice is active in the forms at this stage (FSD Master Data). */
export const RICE_PTYPE = 'PT-PADI';
export const DEFAULT_VARIETY = 'VAR-PD-DEFAULT';

export type PlantResult = Plant & { warnings: string[] };

@Injectable()
export class PlantService {
  constructor(
    @InjectRepository(Plant)
    private readonly plants: Repository<Plant>,
  ) {}

  private get manager() {
    return this.plants.manager;
  }

  async create(tenantId: string, userId: string, dto: CreatePlantDto): Promise<PlantResult & { schedules_created: number }> {
    const cluster = await assertOwned(this.manager, Cluster, { cluster_id: dto.cluster_id, tenant_id: tenantId }, 'Petak');

    const variety = await this.manager.getRepository(PlantVariety).findOne({
      where: { var_id: dto.var_id ?? DEFAULT_VARIETY, ptype_id: RICE_PTYPE },
    });
    if (!variety) throw new BadRequestException('Varietas tidak ditemukan atau bukan varietas padi');

    const sow = parseDay(dto.plant_sow_date, 'Tanggal sebar');
    const planted = parseDay(dto.plant_date, 'Tanggal tanam');
    if (planted < sow) throw new BadRequestException('Tanggal tanam tidak boleh sebelum tanggal sebar');

    const clash = await this.plants.findOne({
      where: { cluster_id: cluster.cluster_id, plant_season: dto.plant_season, plant_sts: 1 },
    });
    if (clash) {
      throw new ConflictException(`Petak ini sudah punya tanaman aktif untuk musim ${dto.plant_season}`);
    }

    const warnings: string[] = [];
    const geomWarning = areaWarning(dto.plant_area, dto.plant_geom);
    if (geomWarning) warnings.push(geomWarning);

    const ptype = await this.manager.getRepository(PlantType).findOne({ where: { ptype_id: RICE_PTYPE } });
    const phases = await this.manager
      .getRepository(PlantPhase)
      .find({ where: { ptype_id: RICE_PTYPE }, order: { phase_seq: 'ASC' } });

    const now = new Date();
    const plant = this.plants.create({
      plant_id: await this.nextId(cluster.cluster_id),
      tenant_id: tenantId,
      site_id: cluster.site_id,
      cluster_id: cluster.cluster_id,
      ptype_id: RICE_PTYPE,
      var_id: variety.var_id,
      phase_id: phaseForAge(phases, daysBetween(dto.plant_date, today()))?.phase_id,
      plant_tag: dto.plant_tag,
      plant_name: dto.plant_name ?? `Padi ${cluster.cluster_name} ${dto.plant_season.replace('-', ' ')}`,
      plant_level: 'BLOCK',
      plant_variety: variety.var_name,
      plant_seed_source: dto.plant_seed_source,
      plant_sow_date: dto.plant_sow_date,
      plant_date: dto.plant_date,
      plant_season: dto.plant_season,
      plant_area: dto.plant_area,
      plant_count: dto.plant_count ?? (ptype?.ptype_density ? Math.round(dto.plant_area * ptype.ptype_density) : undefined),
      plant_lon: dto.plant_lon,
      plant_lat: dto.plant_lat,
      plant_alt: dto.plant_alt,
      plant_geom: dto.plant_geom ? JSON.stringify(dto.plant_geom) : undefined,
      plant_phase_mode: dto.plant_phase_mode ?? 'AUTO',
      plant_desc: dto.plant_desc,
      plant_sts: 1,
      plant_created: now,
      plant_update: now,
    });

    const varietyPhases = await this.manager.getRepository(VarietyPhase).find({ where: { var_id: variety.var_id } });
    const activityTypes = await this.manager.getRepository(ActivityType).find({ where: { ptype_id: RICE_PTYPE } });
    const schedules = buildTemplateSchedules({
      plant: plant as Required<Pick<Plant, 'plant_id' | 'tenant_id' | 'site_id' | 'cluster_id' | 'plant_sow_date' | 'plant_date'>>,
      variety,
      phases,
      varietyPhases,
      activityTypes,
      userId,
      now,
    });

    await this.manager.transaction(async (em) => {
      await em.insert(Plant, plant);
      if (schedules.length) await em.insert(Schedule, schedules);
    });

    return Object.assign(plant, { warnings, schedules_created: schedules.length });
  }

  // {cluster_id}_PLT{n}; computed in JS so the numbering never depends on string ordering
  private async nextId(clusterId: string): Promise<string> {
    const existing = await this.plants.find({ where: { cluster_id: clusterId }, select: ['plant_id'] });
    const re = new RegExp(`^${escapeRegExp(clusterId)}_PLT(\\d+)$`);
    const max = existing.reduce((m, p) => Math.max(m, Number(re.exec(p.plant_id)?.[1] ?? 0)), 0);
    return `${clusterId}_PLT${max + 1}`;
  }

  async findAll(scope: string | undefined, filters: PlantFilterDto = {}): Promise<Plant[]> {
    const where: Record<string, unknown> = {};
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.siteId) where.site_id = filters.siteId;
    if (filters.season) where.plant_season = filters.season;
    if (filters.status !== undefined) where.plant_sts = filters.status;
    return this.plants.find({ where: scoped(where, scope), order: { plant_created: 'DESC' } });
  }

  async findOne(id: string, scope: string | undefined): Promise<Plant> {
    const plant = await this.plants.findOne({ where: scoped({ plant_id: id }, scope) });
    if (!plant) throw new NotFoundException(`Tanaman ${id} tidak ditemukan`);
    return plant;
  }

  async update(id: string, scope: string | undefined, dto: UpdatePlantDto): Promise<PlantResult> {
    const plant = await this.findOne(id, scope);
    if (plant.plant_sts === 0) throw new BadRequestException('Musim sudah ditutup; tanaman tidak bisa diubah');

    const { plant_geom, phase_id, plant_phase_mode, plant_phase_date, ...rest } = dto;
    Object.assign(plant, rest);

    if (plant_phase_mode !== undefined) plant.plant_phase_mode = plant_phase_mode;
    if (phase_id !== undefined || plant_phase_date !== undefined) {
      if (plant.plant_phase_mode !== 'MANUAL') {
        throw new BadRequestException('Fase hanya bisa diatur manual bila mode fase MANUAL');
      }
      if (phase_id !== undefined) {
        const phase = await this.manager.getRepository(PlantPhase).findOne({ where: { phase_id, ptype_id: RICE_PTYPE } });
        if (!phase) throw new BadRequestException('Fase tidak ditemukan untuk padi');
        plant.phase_id = phase_id;
      }
      if (plant_phase_date !== undefined) {
        parseDay(plant_phase_date, 'Tanggal fase');
        plant.plant_phase_date = plant_phase_date;
      }
    }

    if (plant_geom !== undefined) plant.plant_geom = JSON.stringify(plant_geom);

    const warnings: string[] = [];
    const geom = plant_geom ?? (plant.plant_geom ? plant.plant_geom : undefined);
    const warning = areaWarning(plant.plant_area, geom);
    if (warning) warnings.push(warning);

    plant.plant_update = new Date();
    const saved = await this.plants.save(plant);
    return Object.assign(saved, { warnings });
  }

  /** Closes the season and cancels schedules that were never completed. */
  async close(id: string, scope: string | undefined, dto: ClosePlantDto): Promise<Plant & { schedules_cancelled: number }> {
    const plant = await this.findOne(id, scope);
    if (plant.plant_sts === 0) throw new ConflictException('Musim tanaman ini sudah ditutup');

    const harvestDate = dto.plant_harvest_date ?? today();
    parseDay(harvestDate, 'Tanggal panen');
    if (plant.plant_date && daysBetween(plant.plant_date, harvestDate) < 0) {
      throw new BadRequestException('Tanggal panen tidak boleh sebelum tanggal tanam');
    }

    plant.plant_harvest_date = harvestDate;
    plant.plant_sts = 0;
    plant.plant_update = new Date();

    let cancelled = 0;
    await this.manager.transaction(async (em) => {
      await em.save(Plant, plant);
      const res = await em.update(
        Schedule,
        { plant_id: plant.plant_id, sched_sts: In([SCHEDULE_STATUS.PLANNED, SCHEDULE_STATUS.OVERDUE]) },
        { sched_sts: SCHEDULE_STATUS.CANCELLED, sched_update: new Date() },
      );
      cancelled = res.affected ?? 0;
    });

    return Object.assign(plant, { schedules_cancelled: cancelled });
  }
}
