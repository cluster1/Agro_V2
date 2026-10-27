import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Schedule, SCHEDULE_STATUS } from './entities/schedule.entity';
import { Plant } from '../plant/entities/plant.entity';
import { ActivityType } from '../ref/entities/activity-type.entity';
import { PlantPhase } from '../ref/entities/plant-phase.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleFilterDto } from './dto/schedule-filter.dto';
import { assertOwned } from '../common/utils/assert-owned';
import { scoped } from '../common/utils/scope';
import { daysBetween, parseDay, phaseForAge } from '../plant/plant-rules';

const RICE_PTYPE = 'PT-PADI';
const LIST_LIMIT = 2000;

/** '2026-09-29T08:00' | '2026-09-29 08:00:00' -> '2026-09-29 08:00:00' (validated). */
export function normalizeDateTime(value: string, label: string): string {
  const [day, time] = value.replace('T', ' ').split(' ');
  parseDay(day, label);
  const [h, m, s = '00'] = time.split(':');
  if (Number(h) > 23 || Number(m) > 59 || Number(s) > 59) {
    throw new BadRequestException(`${label} bukan waktu yang valid`);
  }
  return `${day} ${h}:${m}:${s}`;
}

const toDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(String(v).replace(' ', 'T')));

/** Stored status 0 turns into 4 (terlambat) once the end passed without a linked activity. */
export function effectiveStatus(row: Pick<Schedule, 'sched_sts' | 'sched_end_date'>, now = new Date()): number {
  const sts = row.sched_sts ?? SCHEDULE_STATUS.PLANNED;
  if (sts === SCHEDULE_STATUS.PLANNED && row.sched_end_date && toDate(row.sched_end_date) < now) {
    return SCHEDULE_STATUS.OVERDUE;
  }
  return sts;
}

const withEffective = (row: Schedule, now: Date): Schedule => ({ ...row, sched_sts: effectiveStatus(row, now) });

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Schedule)
    private readonly schedules: Repository<Schedule>,
  ) {}

  private get manager() {
    return this.schedules.manager;
  }

  private async activityType(id: string): Promise<ActivityType> {
    const type = await this.manager.getRepository(ActivityType).findOne({ where: { actype_id: id } });
    if (!type || type.actype_sts === 0) throw new BadRequestException('Jenis kegiatan tidak ditemukan');
    if (type.ptype_id && type.ptype_id !== RICE_PTYPE) {
      throw new BadRequestException('Jenis kegiatan bukan untuk padi');
    }
    return type;
  }

  /** Cross-field rules shared by create and update. */
  private assertWindow(start: string, end: string, repeat: string, interval?: number | null, until?: string | null) {
    if (end < start) throw new BadRequestException('Waktu selesai tidak boleh sebelum waktu mulai');
    if (repeat === 'NONE') return;
    if (!interval || interval < 1) throw new BadRequestException('Perulangan membutuhkan interval minimal 1');
    if (!until) throw new BadRequestException('Perulangan membutuhkan tanggal berakhir (sched_repeat_until)');
    parseDay(until, 'Tanggal berakhir perulangan');
    if (until < start.slice(0, 10)) {
      throw new BadRequestException('Tanggal berakhir perulangan tidak boleh sebelum tanggal mulai');
    }
  }

  async create(tenantId: string, userId: string, dto: CreateScheduleDto): Promise<Schedule> {
    const plant = await assertOwned(this.manager, Plant, { plant_id: dto.plant_id, tenant_id: tenantId }, 'Tanaman');
    if (plant.plant_sts === 0) throw new BadRequestException('Musim tanaman sudah ditutup');

    const type = await this.activityType(dto.actype_id);
    const start = normalizeDateTime(dto.sched_start_date, 'Waktu mulai');
    const end = normalizeDateTime(dto.sched_end_date, 'Waktu selesai');
    const repeat = dto.sched_repeat ?? 'NONE';
    this.assertWindow(start, end, repeat, dto.sched_interval, dto.sched_repeat_until);

    const phases = await this.manager
      .getRepository(PlantPhase)
      .find({ where: { ptype_id: RICE_PTYPE }, order: { phase_seq: 'ASC' } });
    const phase = plant.plant_date ? phaseForAge(phases, daysBetween(plant.plant_date, start.slice(0, 10))) : undefined;

    const now = new Date();
    const row = this.schedules.create({
      sched_id: uuidv4().replace(/-/g, ''),
      tenant_id: tenantId,
      site_id: plant.site_id,
      cluster_id: plant.cluster_id,
      plant_id: plant.plant_id,
      actype_id: type.actype_id,
      phase_id: phase?.phase_id,
      user_id: userId,
      sched_title: dto.sched_title || type.actype_name,
      sched_desc: dto.sched_desc,
      sched_start_date: start,
      sched_end_date: end,
      sched_repeat: repeat,
      sched_interval: repeat === 'NONE' ? undefined : dto.sched_interval,
      sched_repeat_until: repeat === 'NONE' ? undefined : dto.sched_repeat_until,
      sched_plan_value: dto.sched_plan_value,
      unit_id: dto.unit_id ?? type.unit_id ?? undefined,
      sched_remind: dto.sched_remind,
      sched_source: 'MANUAL',
      sched_sts: SCHEDULE_STATUS.PLANNED,
      sched_created: now,
      sched_update: now,
    });
    await this.schedules.save(row);
    return withEffective(row, now);
  }

  async findAll(scope: string | undefined, filters: ScheduleFilterDto = {}): Promise<Schedule[]> {
    const where: Record<string, unknown> = {};
    if (filters.plantId) where.plant_id = filters.plantId;
    if (filters.clusterId) where.cluster_id = filters.clusterId;
    if (filters.from && filters.to) {
      where.sched_start_date = Between(`${filters.from} 00:00:00`, `${filters.to} 23:59:59`);
    } else if (filters.from) {
      where.sched_start_date = MoreThanOrEqual(`${filters.from} 00:00:00`);
    } else if (filters.to) {
      where.sched_start_date = LessThanOrEqual(`${filters.to} 23:59:59`);
    }

    const rows = await this.schedules.find({
      where: scoped(where, scope),
      order: { sched_start_date: 'ASC' },
      take: LIST_LIMIT,
    });
    const now = new Date();
    const list = rows.map((r) => withEffective(r, now));
    return filters.status === undefined ? list : list.filter((r) => r.sched_sts === filters.status);
  }

  async findOne(id: string, scope: string | undefined): Promise<Schedule> {
    const row = await this.schedules.findOne({ where: scoped({ sched_id: id }, scope) });
    if (!row) throw new NotFoundException(`Jadwal ${id} tidak ditemukan`);
    return withEffective(row, new Date());
  }

  async update(id: string, scope: string | undefined, dto: UpdateScheduleDto): Promise<Schedule> {
    const row = await this.schedules.findOne({ where: scoped({ sched_id: id }, scope) });
    if (!row) throw new NotFoundException(`Jadwal ${id} tidak ditemukan`);
    if (row.sched_sts === SCHEDULE_STATUS.DONE || row.sched_sts === SCHEDULE_STATUS.CANCELLED) {
      throw new BadRequestException('Jadwal yang sudah selesai atau dibatalkan tidak bisa diubah');
    }

    const { actype_id, sched_start_date, sched_end_date, sched_sts, ...rest } = dto;
    if (actype_id !== undefined && actype_id !== row.actype_id) {
      const type = await this.activityType(actype_id);
      row.actype_id = type.actype_id;
      if (rest.sched_title === undefined) row.sched_title = type.actype_name;
      if (rest.unit_id === undefined && type.unit_id) row.unit_id = type.unit_id;
    }
    Object.assign(row, rest);
    if (sched_start_date !== undefined) row.sched_start_date = normalizeDateTime(sched_start_date, 'Waktu mulai');
    if (sched_end_date !== undefined) row.sched_end_date = normalizeDateTime(sched_end_date, 'Waktu selesai');

    const repeat = row.sched_repeat ?? 'NONE';
    this.assertWindow(String(row.sched_start_date), String(row.sched_end_date), repeat, row.sched_interval, row.sched_repeat_until);
    if (repeat === 'NONE') {
      row.sched_interval = null as unknown as number;
      row.sched_repeat_until = null as unknown as string;
    }

    if (sched_sts !== undefined) row.sched_sts = sched_sts;
    row.sched_update = new Date();
    const saved = await this.schedules.save(row);
    return withEffective(saved, new Date());
  }

  async remove(id: string, scope: string | undefined): Promise<void> {
    const row = await this.schedules.findOne({ where: scoped({ sched_id: id }, scope) });
    if (!row) throw new NotFoundException(`Jadwal ${id} tidak ditemukan`);
    if (row.sched_sts === SCHEDULE_STATUS.DONE) {
      throw new ConflictException('Jadwal sudah memiliki kegiatan dan tidak bisa dihapus');
    }
    await this.schedules.delete({ sched_id: row.sched_id });
  }
}
