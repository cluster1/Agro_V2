import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityTarget, FindOptionsOrder, ObjectLiteral, Repository } from 'typeorm';
import { PlantType } from './entities/plant-type.entity';
import { PlantPhase } from './entities/plant-phase.entity';
import { PlantVariety } from './entities/plant-variety.entity';
import { VarietyPhase } from './entities/variety-phase.entity';
import { PhaseParam } from './entities/phase-param.entity';
import { ActivityType } from './entities/activity-type.entity';
import { Material } from './entities/material.entity';
import { TelemetryCode } from './entities/telemetry-code.entity';
import { Unit } from '../unit/entities/unit.entity';
import { IMMUTABLE, REFERENCES, FK_IN_USE, DUPLICATE, Actor } from './ref-write-config';
import { RefQueryDto } from './dto/ref-query.dto';
import { v4 as uuidv4 } from 'uuid';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { GENERATED_ID, ID_MAX, ID_RE, RULES, Row, UPDATE_STAMP, WRITE_ROLES, parseBody } from './ref-schema';

interface Resource {
  entity: EntityTarget<any>;
  key: string;
  order: FindOptionsOrder<any>;
  /** query param -> column; only these may filter the list */
  filters: Record<string, string>;
}

/** Read-only reference data (BR-16). Global, not tenant scoped. */
export const REF_RESOURCES: Record<string, Resource> = {
  'plant-types': { entity: PlantType, key: 'ptype_id', order: { ptype_name: 'ASC' }, filters: {} },
  phases: {
    entity: PlantPhase,
    key: 'phase_id',
    order: { ptype_id: 'ASC', phase_seq: 'ASC' },
    filters: { ptype_id: 'ptype_id' },
  },
  varieties: {
    entity: PlantVariety,
    key: 'var_id',
    order: { var_name: 'ASC' },
    filters: { ptype_id: 'ptype_id' },
  },
  'variety-phases': {
    entity: VarietyPhase,
    key: 'vp_id',
    order: { var_id: 'ASC', vp_start_age: 'ASC' },
    filters: { var_id: 'var_id', phase_id: 'phase_id' },
  },
  'phase-params': {
    entity: PhaseParam,
    key: 'ppp_id',
    order: { phase_id: 'ASC', kt_id: 'ASC' },
    filters: { phase_id: 'phase_id', kt_id: 'kt_id' },
  },
  'activity-types': {
    entity: ActivityType,
    key: 'actype_id',
    order: { actype_category: 'ASC', actype_name: 'ASC' },
    filters: { ptype_id: 'ptype_id', category: 'actype_category' },
  },
  materials: {
    entity: Material,
    key: 'mat_id',
    order: { mat_category: 'ASC', mat_name: 'ASC' },
    filters: { category: 'mat_category' },
  },
  telemetry: { entity: TelemetryCode, key: 'kt_id', order: { kt_id: 'ASC' }, filters: {} },
  units: { entity: Unit, key: 'unit_id', order: { unit_name: 'ASC' }, filters: {} },
};

@Injectable()
export class RefService {
  private readonly audit = new Logger('RefAudit');

  constructor(
    @InjectRepository(PlantType) private readonly plantTypes: Repository<PlantType>,
  ) {}

  private resource(name: string): Resource {
    const res = Object.prototype.hasOwnProperty.call(REF_RESOURCES, name) ? REF_RESOURCES[name] : undefined;
    if (!res) throw new NotFoundException(`Referensi '${name}' tidak ditemukan`);
    return res;
  }

  private repo(res: Resource): Repository<ObjectLiteral> {
    return this.plantTypes.manager.getRepository(res.entity);
  }

  async findAll(name: string, query: RefQueryDto): Promise<ObjectLiteral[]> {
    const res = this.resource(name);
    const where: Record<string, string> = {};
    for (const [param, column] of Object.entries(res.filters)) {
      const value = (query as Record<string, string | undefined>)[param];
      if (value) where[column] = value;
    }
    return this.repo(res).find({ where, order: res.order });
  }

  async findOne(name: string, id: string): Promise<ObjectLiteral> {
    const res = this.resource(name);
    const row = await this.repo(res).findOne({ where: { [res.key]: id } });
    if (!row) throw new NotFoundException(`Data referensi '${id}' tidak ditemukan`);
    return row;
  }

  // ---------------------------------------------------------------- writes (BR-16)

  private assertCanWrite(actor: Actor, name: string): void {
    this.resource(name);
    if (!WRITE_ROLES[name]?.includes(actor.user_role)) {
      throw new ForbiddenException('Anda tidak boleh mengubah data referensi ini');
    }
  }

  private async assertReferences(name: string, row: Row): Promise<void> {
    for (const [field, ref] of Object.entries(REFERENCES[name] ?? {})) {
      const value = row[field];
      if (value === undefined || value === null) continue;
      const found = await this.plantTypes.manager.getRepository(ref.entity).findOne({ where: { [ref.key]: value } });
      if (!found) throw new BadRequestException(`${field}: '${value}' tidak ditemukan`);
    }
  }

  /** Phases of one commodity must not overlap in age ([start, end), open end = unbounded). */
  private async assertNoOverlap(row: Row, selfId?: string): Promise<void> {
    const start = row.phase_start_age as number | null | undefined;
    const end = row.phase_end_age as number | null | undefined;
    if (start === undefined || start === null) return;
    const others = (await this.plantTypes.manager
      .getRepository(PlantPhase)
      .find({ where: { ptype_id: row.ptype_id as string } })) as PlantPhase[];
    const hi = end ?? Infinity;
    for (const o of others) {
      if (o.phase_id === selfId || o.phase_start_age === null || o.phase_start_age === undefined) continue;
      const oHi = o.phase_end_age ?? Infinity;
      if (start < oHi && o.phase_start_age < hi) {
        throw new BadRequestException(`Rentang umur fase tumpang tindih dengan '${o.phase_name}' (${o.phase_id})`);
      }
    }
  }

  private mapDbError(error: unknown): never {
    const code = (error as { code?: string })?.code ?? '';
    if (DUPLICATE.includes(code)) throw new ConflictException('Data dengan kunci yang sama sudah ada');
    if (FK_IN_USE.includes(code)) throw new ConflictException('Data masih dipakai data lain dan tidak bisa dihapus');
    throw error;
  }

  /** Tables have no per-user column; who changed what goes to the structured log (F-SEC-03 later). */
  private log(actor: Actor, action: string, name: string, id: string): void {
    this.audit.log(JSON.stringify({ action, resource: name, id, user_id: actor.user_id, role: actor.user_role }));
  }

  private assertCalibrationRole(actor: Actor, name: string, next: Row, current?: Row): void {
    if (name !== 'variety-phases' || next.vp_source !== 'KALIBRASI') return;
    if (current?.vp_source === 'KALIBRASI') return;
    if (actor.user_role !== 'agronom') {
      throw new ForbiddenException('Hanya agronom yang dapat menetapkan sumber KALIBRASI');
    }
  }

  async create(actor: Actor, name: string, body: unknown): Promise<ObjectLiteral> {
    this.assertCanWrite(actor, name);
    const res = this.resource(name);
    const values = parseBody(name, body, 'create');

    let id = (body as Row)?.id as string | undefined;
    if (GENERATED_ID.has(name)) {
      id = id || uuidv4().replace(/-/g, '');
    } else {
      const max = ID_MAX[name] ?? 32;
      if (typeof id !== 'string' || !ID_RE.test(id) || id.length > max) {
        throw new BadRequestException(`id wajib diisi: huruf besar, angka, '-' atau '_', maksimal ${max} karakter`);
      }
    }

    const errors = RULES[name]?.(values) ?? [];
    if (errors.length) throw new BadRequestException(errors.join('; '));
    await this.assertReferences(name, values);
    if (name === 'phases') await this.assertNoOverlap(values);
    this.assertCalibrationRole(actor, name, values);

    const repo = this.repo(res);
    if (await repo.findOne({ where: { [res.key]: id } })) throw new ConflictException(`'${id}' sudah ada`);

    const stamp = UPDATE_STAMP[name];
    const row = { [res.key]: id, ...values, ...(stamp ? { [stamp]: new Date() } : {}) };
    try {
      await repo.insert(row);
    } catch (error) {
      this.mapDbError(error);
    }
    this.log(actor, 'create', name, id as string);
    return row;
  }

  async update(actor: Actor, name: string, id: string, body: unknown): Promise<ObjectLiteral> {
    this.assertCanWrite(actor, name);
    const res = this.resource(name);
    const values = parseBody(name, body, 'update');
    if (!Object.keys(values).length) throw new BadRequestException('Tidak ada perubahan');

    const current = (await this.findOne(name, id)) as Row;
    for (const key of IMMUTABLE[name] ?? []) {
      if (key in values && values[key] !== current[key]) throw new BadRequestException(`${key} tidak bisa diubah`);
    }

    const merged = { ...current, ...values };
    const errors = RULES[name]?.(merged) ?? [];
    if (errors.length) throw new BadRequestException(errors.join('; '));
    await this.assertReferences(name, values);
    if (name === 'phases') await this.assertNoOverlap(merged, id);
    this.assertCalibrationRole(actor, name, values, current);

    const stamp = UPDATE_STAMP[name];
    const patch = { ...values, ...(stamp ? { [stamp]: new Date() } : {}) };
    try {
      await this.repo(res).update({ [res.key]: id }, patch);
    } catch (error) {
      this.mapDbError(error);
    }
    this.log(actor, 'update', name, id);
    return { ...current, ...patch };
  }

  async remove(actor: Actor, name: string, id: string): Promise<void> {
    this.assertCanWrite(actor, name);
    const res = this.resource(name);
    await this.findOne(name, id);

    if (name === 'telemetry') {
      const used = await this.plantTypes.manager.getRepository(DeviceSensor).count({ where: { kt_id: id } });
      if (used > 0) throw new ConflictException('Kode telemetri dipakai sensor dan tidak bisa dihapus');
    }
    try {
      await this.repo(res).delete({ [res.key]: id });
    } catch (error) {
      this.mapDbError(error);
    }
    this.log(actor, 'delete', name, id);
  }
}
