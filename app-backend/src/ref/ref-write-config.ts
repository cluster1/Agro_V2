import { EntityTarget } from 'typeorm';
import { PlantType } from './entities/plant-type.entity';
import { PlantPhase } from './entities/plant-phase.entity';
import { PlantVariety } from './entities/plant-variety.entity';
import { TelemetryCode } from './entities/telemetry-code.entity';
import { Unit } from '../unit/entities/unit.entity';

/** Keys that identify a row and must not change after creation. */
export const IMMUTABLE: Record<string, string[]> = {
  phases: ['ptype_id'],
  varieties: ['ptype_id'],
  'variety-phases': ['var_id', 'phase_id'],
  'phase-params': ['phase_id', 'kt_id'],
};

/** Foreign references that must exist, per resource: field -> entity. */
export const REFERENCES: Record<string, Record<string, { entity: EntityTarget<any>; key: string }>> = {
  phases: { ptype_id: { entity: PlantType, key: 'ptype_id' } },
  varieties: { ptype_id: { entity: PlantType, key: 'ptype_id' }, unit_id: { entity: Unit, key: 'unit_id' } },
  'variety-phases': {
    var_id: { entity: PlantVariety, key: 'var_id' },
    phase_id: { entity: PlantPhase, key: 'phase_id' },
  },
  'phase-params': {
    phase_id: { entity: PlantPhase, key: 'phase_id' },
    kt_id: { entity: TelemetryCode, key: 'kt_id' },
    unit_id: { entity: Unit, key: 'unit_id' },
  },
  'activity-types': { ptype_id: { entity: PlantType, key: 'ptype_id' }, unit_id: { entity: Unit, key: 'unit_id' } },
  materials: { unit_id: { entity: Unit, key: 'unit_id' } },
};

export const FK_IN_USE = ['ER_ROW_IS_REFERENCED_2', 'ER_ROW_IS_REFERENCED'];
export const DUPLICATE = ['ER_DUP_ENTRY'];

export interface Actor {
  user_id: string;
  user_role: string;
}
