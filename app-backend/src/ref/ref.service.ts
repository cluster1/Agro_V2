import { Injectable, NotFoundException } from '@nestjs/common';
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
import { RefQueryDto } from './dto/ref-query.dto';

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
}
