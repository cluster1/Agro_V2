import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Observation, OBSERVATION_STATUS } from './entities/observation.entity';
import { Plant } from '../plant/entities/plant.entity';
import { Media } from '../media/entities/media.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { CreateObservationDto } from './dto/create-observation.dto';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { ObservationFilterDto } from './dto/observation-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { escapeRegExp } from '../common/utils/escape-regexp';
import { scoped } from '../common/utils/scope';
import { daysBetween, phaseForAge } from '../plant/plant-rules';
import { normalizeDateTime } from '../schedule/schedule.service';
import { stripRejection, validateMeasurements, withRejection } from './observation-rules';

const RICE_PTYPE = 'PT-PADI';
const DEFAULT_SAMPLE_N = 20;
const LIST_LIMIT = 2000;
const EDITABLE = [OBSERVATION_STATUS.DRAFT, OBSERVATION_STATUS.SAVED, OBSERVATION_STATUS.REJECTED] as number[];

const MEASURE_FIELDS = [
  'obs_height',
  'obs_tiller',
  'obs_bwd',
  'obs_panicle',
  'obs_grain',
  'obs_filled_pct',
  'obs_phase_pct',
  'obs_pest_name',
  'obs_pest_pct',
  'obs_lon',
  'obs_lat',
] as const;

@Injectable()
export class ObservationService {
  constructor(
    @InjectRepository(Observation)
    private readonly observations: Repository<Observation>,
  ) {}

  private get manager() {
    return this.observations.manager;
  }

  /** HST, phase id and generic phase sequence at the observation day. */
  private async context(plant: Plant, day: string): Promise<{ age: number; phase_id?: string; phaseSeq?: number }> {
    if (!plant.plant_date) throw new BadRequestException('Tanggal tanam tanaman belum diisi');
    if (plant.plant_sow_date && daysBetween(plant.plant_sow_date, day) < 0) {
      throw new BadRequestException('Tanggal observasi tidak boleh sebelum tanggal sebar');
    }
    const age = daysBetween(plant.plant_date, day);
    const phases = await this.manager
      .getRepository(PlantPhase)
      .find({ where: { ptype_id: RICE_PTYPE }, order: { phase_seq: 'ASC' } });
    const generic = phaseForAge(phases, age);
    if (plant.plant_phase_mode === 'MANUAL' && plant.phase_id) {
      const manual = phases.find((p) => p.phase_id === plant.phase_id);
      return { age, phase_id: plant.phase_id, phaseSeq: manual?.phase_seq };
    }
    return { age, phase_id: generic?.phase_id, phaseSeq: generic?.phase_seq };
  }

  private async nextId(plantId: string): Promise<string> {
    const existing = await this.observations.find({ where: { plant_id: plantId }, select: ['obs_id'] });
    const re = new RegExp(`^${escapeRegExp(plantId)}_OBS(\\d+)$`);
    const max = existing.reduce((m, o) => Math.max(m, Number(re.exec(o.obs_id)?.[1] ?? 0)), 0);
    return `${plantId}_OBS${max + 1}`;
  }

  /** `dryRun` runs every rule and returns the would-be row without writing (used by import preview). */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateObservationDto,
    opts: { source?: string; dryRun?: boolean } = {},
  ): Promise<Observation> {
    const plant = await assertOwned(this.manager, Plant, { plant_id: dto.plant_id, tenant_id: tenantId }, 'Tanaman');
    if (plant.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup');

    const date = normalizeDateTime(dto.obs_date, 'Waktu observasi');
    const ctx = await this.context(plant, date.slice(0, 10));
    const symptom = dto.obs_symptom?.length ? [...new Set(dto.obs_symptom)].join(',') : undefined;
    validateMeasurements({ ...dto, obs_symptom: symptom }, ctx);

    const mediaIds = [...new Set(dto.media_ids ?? [])];
    if (mediaIds.length) {
      const found = await this.manager.getRepository(Media).find({
        where: { media_id: In(mediaIds), tenant_id: tenantId, obs_id: IsNull() },
      });
      if (found.length !== mediaIds.length) {
        throw new BadRequestException('Foto tidak ditemukan atau sudah dipakai observasi lain');
      }
    }

    const now = new Date();
    const row = this.observations.create({
      obs_id: await this.nextId(plant.plant_id),
      tenant_id: tenantId,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      phase_id: ctx.phase_id,
      user_id: userId,
      obs_date: date,
      obs_age: ctx.age,
      obs_sample_n: dto.obs_sample_n ?? DEFAULT_SAMPLE_N,
      ...Object.fromEntries(MEASURE_FIELDS.map((f) => [f, dto[f]])),
      obs_symptom: symptom,
      obs_desc: dto.obs_desc,
      obs_source: opts.source ?? 'WEB',
      obs_sts: dto.draft ? OBSERVATION_STATUS.DRAFT : OBSERVATION_STATUS.SAVED,
      obs_created: now,
      obs_update: now,
    });

    if (opts.dryRun) return row;

    await this.manager.transaction(async (em) => {
      await em.insert(Observation, row);
      if (mediaIds.length) {
        await em.update(Media, { media_id: In(mediaIds) }, { obs_id: row.obs_id, plant_id: plant.plant_id });
      }
    });
    return row;
  }

  async findAll(scope: string | undefined, filters: ObservationFilterDto = {}): Promise<Observation[]> {
    const where: Record<string, unknown> = {};
    if (filters.plantId) where.plant_id = filters.plantId;
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.status !== undefined) where.obs_sts = filters.status;
    if (filters.source) where.obs_source = filters.source;
    if (filters.from && filters.to) where.obs_date = Between(`${filters.from} 00:00:00`, `${filters.to} 23:59:59`);
    else if (filters.from) where.obs_date = MoreThanOrEqual(`${filters.from} 00:00:00`);
    else if (filters.to) where.obs_date = LessThanOrEqual(`${filters.to} 23:59:59`);
    return this.observations.find({ where: scoped(where, scope), order: { obs_date: 'DESC' }, take: LIST_LIMIT });
  }

  async findOne(id: string, scope: string | undefined): Promise<Observation> {
    const row = await this.observations.findOne({ where: scoped({ obs_id: id }, scope) });
    if (!row) throw new NotFoundException(`Observasi ${id} tidak ditemukan`);
    return row;
  }

  async update(id: string, scope: string | undefined, dto: UpdateObservationDto): Promise<Observation> {
    const row = await this.findOne(id, scope);
    if (!EDITABLE.includes(row.obs_sts)) {
      throw new BadRequestException('Observasi yang sudah terverifikasi tidak bisa diubah');
    }
    const plant = await this.manager.getRepository(Plant).findOne({ where: { plant_id: row.plant_id } });
    if (!plant) throw new NotFoundException('Tanaman tidak ditemukan');
    if (plant.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup');

    const wasRejected = row.obs_sts === OBSERVATION_STATUS.REJECTED;
    const { obs_symptom, obs_date, draft, obs_desc, obs_sample_n, ...numeric } = dto;
    Object.assign(row, numeric);
    if (obs_sample_n !== undefined) row.obs_sample_n = obs_sample_n;
    if (obs_symptom !== undefined) row.obs_symptom = obs_symptom.length ? [...new Set(obs_symptom)].join(',') : (null as unknown as string);
    if (obs_date !== undefined) row.obs_date = normalizeDateTime(obs_date, 'Waktu observasi');
    if (obs_desc !== undefined) row.obs_desc = obs_desc;
    else if (wasRejected) row.obs_desc = stripRejection(row.obs_desc);

    const ctx = await this.context(plant, String(row.obs_date).slice(0, 10));
    validateMeasurements(row, ctx);
    row.obs_age = ctx.age;
    row.phase_id = ctx.phase_id as string;
    row.obs_sts = draft ? OBSERVATION_STATUS.DRAFT : OBSERVATION_STATUS.SAVED;
    row.obs_update = new Date();
    return this.observations.save(row);
  }

  /** Agronom verifies a saved observation; only verified rows feed calibration and twin accuracy. */
  async verify(id: string, scope: string | undefined): Promise<Observation> {
    const row = await this.findOne(id, scope);
    if (row.obs_sts !== OBSERVATION_STATUS.SAVED) {
      throw new BadRequestException('Hanya observasi berstatus tersimpan yang bisa diverifikasi');
    }
    row.obs_sts = OBSERVATION_STATUS.VERIFIED;
    row.obs_update = new Date();
    return this.observations.save(row);
  }

  async reject(id: string, scope: string | undefined, reason: string): Promise<Observation> {
    const row = await this.findOne(id, scope);
    if (row.obs_sts !== OBSERVATION_STATUS.SAVED) {
      throw new BadRequestException('Hanya observasi berstatus tersimpan yang bisa ditolak');
    }
    row.obs_sts = OBSERVATION_STATUS.REJECTED;
    row.obs_desc = withRejection(reason.trim(), row.obs_desc);
    row.obs_update = new Date();
    return this.observations.save(row);
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const row = await this.findOne(id, scope);
    if (row.obs_sts === OBSERVATION_STATUS.VERIFIED) {
      throw new BadRequestException('Observasi yang sudah terverifikasi tidak bisa dihapus');
    }
    await this.manager.transaction(async (em) => {
      await em.update(Media, { obs_id: row.obs_id }, { obs_id: null as unknown as string });
      await em.delete(Observation, { obs_id: row.obs_id });
    });
  }
}
