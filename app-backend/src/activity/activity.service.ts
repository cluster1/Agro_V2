import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Activity, ACTIVITY_STATUS } from './entities/activity.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Schedule, SCHEDULE_STATUS } from '../schedule/entities/schedule.entity';
import { Media } from '../media/entities/media.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { Material } from '../ref/entities/material.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { Unit } from '../unit/entities/unit.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityFilterDto } from './dto/activity-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { scoped } from '../common/utils/scope';
import { daysBetween, phaseForAge } from '../plant/plant-rules';
import { normalizeDateTime } from '../schedule/schedule.service';
import { NutrientInput, nutrientInput, parseAmount, requiresMaterial } from './activity-rules';

const RICE_PTYPE = 'PT-PADI';
const KG_UNIT = 'UNIT-KG';
const LIST_LIMIT = 2000;
const FK_ERRORS = ['ER_ROW_IS_REFERENCED_2', 'ER_ROW_IS_REFERENCED'];

export type ActivityView = Activity & { nutrient_input: NutrientInput | null };

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private readonly activities: Repository<Activity>,
  ) {}

  private get manager() {
    return this.activities.manager;
  }

  private async activityType(id: string): Promise<ActivityType> {
    const type = await this.manager.getRepository(ActivityType).findOne({ where: { actype_id: id } });
    if (!type || type.actype_sts === 0) throw new BadRequestException('Jenis kegiatan tidak ditemukan');
    if (type.ptype_id && type.ptype_id !== RICE_PTYPE) throw new BadRequestException('Jenis kegiatan bukan untuk padi');
    return type;
  }

  /** Material, unit and value rules of F-BDY-03; returns the resolved material and unit. */
  private async resolveDetails(
    type: ActivityType,
    matId: string | null | undefined,
    value: string | null | undefined,
    unitId: string | null | undefined,
  ): Promise<{ material: Material | null; unit_id: string | undefined }> {
    let material: Material | null = null;
    if (matId) {
      material = await this.manager.getRepository(Material).findOne({ where: { mat_id: matId } });
      if (!material || material.mat_sts === 0) throw new BadRequestException('Bahan tidak ditemukan');
    } else if (requiresMaterial(type.actype_category)) {
      throw new BadRequestException(`Kegiatan ${type.actype_category} wajib memilih bahan`);
    }

    if (requiresMaterial(type.actype_category)) {
      const amount = parseAmount(value);
      if (amount === undefined || amount <= 0) {
        throw new BadRequestException(`Kegiatan ${type.actype_category} wajib berisi jumlah numerik lebih dari 0`);
      }
    } else if (value !== undefined && value !== null && value !== '' && String(value).length > 64) {
      throw new BadRequestException('Nilai terlalu panjang');
    }

    if (unitId) {
      const unit = await this.manager.getRepository(Unit).findOne({ where: { unit_id: unitId } });
      if (!unit) throw new BadRequestException('Satuan tidak ditemukan');
    }
    return { material, unit_id: unitId ?? type.unit_id ?? undefined };
  }

  private async phaseAt(plant: Plant, day: string): Promise<string | undefined> {
    if (plant.plant_phase_mode === 'MANUAL' && plant.phase_id) return plant.phase_id;
    if (!plant.plant_date) return undefined;
    const phases = await this.manager
      .getRepository(PlantPhase)
      .find({ where: { ptype_id: RICE_PTYPE }, order: { phase_seq: 'ASC' } });
    return phaseForAge(phases, daysBetween(plant.plant_date, day))?.phase_id;
  }

  private present(row: Activity, material: Material | null | undefined, areaHa: number | null | undefined): ActivityView {
    const nutrients =
      row.unit_id === KG_UNIT ? nutrientInput(parseAmount(row.pact_value), material, areaHa) : null;
    const meaningful = nutrients && (nutrients.n_kg_ha || nutrients.p2o5_kg_ha || nutrients.k2o_kg_ha) ? nutrients : null;
    return { ...row, nutrient_input: meaningful };
  }

  // {plant_id}_ACT{n}; the highest existing suffix wins so numbering survives deletes
  private async nextId(plantId: string): Promise<string> {
    const existing = await this.activities.find({ where: { plant_id: plantId }, select: ['pact_id'] });
    const re = new RegExp(`^${escapeRegExp(plantId)}_ACT(\\d+)$`);
    const max = existing.reduce((m, a) => Math.max(m, Number(re.exec(a.pact_id)?.[1] ?? 0)), 0);
    return `${plantId}_ACT${max + 1}`;
  }

  async create(tenantId: string, userId: string, dto: CreateActivityDto): Promise<ActivityView> {
    const plant = await assertOwned(this.manager, Plant, { plant_id: dto.plant_id, tenant_id: tenantId }, 'Tanaman');
    if (plant.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup');

    const type = await this.activityType(dto.actype_id);
    const date = normalizeDateTime(dto.pact_date, 'Waktu kegiatan');
    const { material, unit_id } = await this.resolveDetails(type, dto.mat_id, dto.pact_value, dto.unit_id);

    if (dto.sched_id) {
      const sched = await assertOwned(
        this.manager,
        Schedule,
        { sched_id: dto.sched_id, tenant_id: tenantId, plant_id: plant.plant_id },
        'Jadwal',
      );
      if (sched.sched_sts === SCHEDULE_STATUS.DONE || sched.sched_sts === SCHEDULE_STATUS.CANCELLED) {
        throw new BadRequestException('Jadwal sudah selesai atau dibatalkan');
      }
    }

    const mediaIds = [...new Set(dto.media_ids ?? [])];
    if (type.actype_need_photo === 1 && mediaIds.length === 0) {
      throw new BadRequestException('Jenis kegiatan ini wajib menyertakan foto (media_ids)');
    }
    if (mediaIds.length) {
      const found = await this.manager.getRepository(Media).find({
        where: { media_id: In(mediaIds), tenant_id: tenantId, pact_id: IsNull() },
      });
      if (found.length !== mediaIds.length) {
        throw new BadRequestException('Foto tidak ditemukan atau sudah dipakai kegiatan lain');
      }
    }

    const now = new Date();
    const row = this.activities.create({
      pact_id: await this.nextId(plant.plant_id),
      tenant_id: tenantId,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      sched_id: dto.sched_id,
      actype_id: type.actype_id,
      phase_id: await this.phaseAt(plant, date.slice(0, 10)),
      user_id: userId,
      pact_desc: dto.pact_desc,
      pact_value: dto.pact_value,
      unit_id,
      mat_id: material?.mat_id,
      pact_material: material?.mat_name,
      pact_worker: dto.pact_worker,
      pact_cost: dto.pact_cost,
      pact_lon: dto.pact_lon,
      pact_lat: dto.pact_lat,
      pact_source: 'WEB',
      pact_date: date,
      pact_sts: ACTIVITY_STATUS.SAVED,
      pact_created: now,
      pact_update: now,
    });

    await this.manager.transaction(async (em) => {
      await em.insert(Activity, row);
      if (dto.sched_id) {
        await em.update(Schedule, { sched_id: dto.sched_id }, { sched_sts: SCHEDULE_STATUS.DONE, sched_update: now });
      }
      if (mediaIds.length) {
        await em.update(Media, { media_id: In(mediaIds) }, { pact_id: row.pact_id, plant_id: plant.plant_id });
      }
    });

    return this.present(row, material, plant.plant_area);
  }

  async findAll(scope: string | undefined, filters: ActivityFilterDto = {}): Promise<ActivityView[]> {
    const where: Record<string, unknown> = {};
    if (filters.plantId) where.plant_id = filters.plantId;
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.actypeId) where.actype_id = filters.actypeId;
    if (filters.from && filters.to) where.pact_date = Between(`${filters.from} 00:00:00`, `${filters.to} 23:59:59`);
    else if (filters.from) where.pact_date = MoreThanOrEqual(`${filters.from} 00:00:00`);
    else if (filters.to) where.pact_date = LessThanOrEqual(`${filters.to} 23:59:59`);

    const rows = await this.activities.find({ where: scoped(where, scope), order: { pact_date: 'DESC' }, take: LIST_LIMIT });
    return this.presentMany(rows);
  }

  private async presentMany(rows: Activity[]): Promise<ActivityView[]> {
    if (!rows.length) return [];
    const matIds = [...new Set(rows.map((r) => r.mat_id).filter(Boolean))] as string[];
    const plantIds = [...new Set(rows.map((r) => r.plant_id).filter(Boolean))] as string[];
    const materials = matIds.length ? await this.manager.getRepository(Material).find({ where: { mat_id: In(matIds) } }) : [];
    const plants = await this.manager.getRepository(Plant).find({ where: { plant_id: In(plantIds) } });
    const matById = new Map(materials.map((m) => [m.mat_id, m]));
    const areaById = new Map(plants.map((p) => [p.plant_id, p.plant_area]));
    return rows.map((r) => this.present(r, r.mat_id ? matById.get(r.mat_id) : null, areaById.get(r.plant_id)));
  }

  async findOne(id: string, scope: string | undefined): Promise<ActivityView> {
    const row = await this.activities.findOne({ where: scoped({ pact_id: id }, scope) });
    if (!row) throw new NotFoundException(`Kegiatan ${id} tidak ditemukan`);
    return (await this.presentMany([row]))[0];
  }

  async update(id: string, scope: string | undefined, dto: UpdateActivityDto): Promise<ActivityView> {
    const row = await this.activities.findOne({ where: scoped({ pact_id: id }, scope) });
    if (!row) throw new NotFoundException(`Kegiatan ${id} tidak ditemukan`);

    const plant = await this.manager.getRepository(Plant).findOne({ where: { plant_id: row.plant_id } });
    if (plant?.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup');

    const { pact_date, ...rest } = dto;
    Object.assign(row, rest);
    if (pact_date !== undefined) {
      row.pact_date = normalizeDateTime(pact_date, 'Waktu kegiatan');
      if (plant) row.phase_id = (await this.phaseAt(plant, row.pact_date.slice(0, 10))) ?? row.phase_id;
    }

    const type = await this.activityType(row.actype_id);
    const { material, unit_id } = await this.resolveDetails(type, row.mat_id, row.pact_value, row.unit_id);
    row.unit_id = unit_id as string;
    row.pact_material = material?.mat_name as string;
    row.pact_update = new Date();

    const saved = await this.activities.save(row);
    return this.present(saved, material, plant?.plant_area);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const row = await this.activities.findOne({ where: scoped({ pact_id: id }, scope) });
    if (!row) throw new NotFoundException(`Kegiatan ${id} tidak ditemukan`);

    try {
      await this.manager.transaction(async (em) => {
        await em.update(Media, { pact_id: row.pact_id }, { pact_id: null as unknown as string });
        await em.delete(Activity, { pact_id: row.pact_id });
        if (row.sched_id) {
          // reopen the schedule unless another activity still fulfils it
          const others = await em.count(Activity, { where: { sched_id: row.sched_id } });
          if (others === 0) {
            await em.update(
              Schedule,
              { sched_id: row.sched_id, sched_sts: SCHEDULE_STATUS.DONE },
              { sched_sts: SCHEDULE_STATUS.PLANNED, sched_update: new Date() },
            );
          }
        }
      });
    } catch (error) {
      if (FK_ERRORS.includes((error as { code?: string })?.code ?? '')) {
        throw new ConflictException('Kegiatan dipakai data lain (mis. panen) dan tidak bisa dihapus');
      }
      throw error;
    }
  }
}
