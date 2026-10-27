import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RefService } from './ref.service';
import { RefController } from './ref.controller';
import { PlantType } from './entities/plant-type.entity';
import { PlantPhase } from './entities/plant-phase.entity';
import { PlantVariety } from './entities/plant-variety.entity';
import { TelemetryCode } from './entities/telemetry-code.entity';
import { VarietyPhase } from './entities/variety-phase.entity';
import { Unit } from '../unit/entities/unit.entity';
import { DeviceSensor } from '../device-sensor/entities/device-sensor.entity';
import { RULES, WRITE_ROLES, parseBody } from './ref-schema';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

const admin = { user_id: 'ga', user_role: 'admin' };
const agronom = { user_id: 'ag', user_role: 'agronom' };
const tenantAdmin = { user_id: 'ta', user_role: 'tenant_admin' };

describe('parseBody', () => {
  it('rejects unknown fields, non-objects, wrong types and out-of-range values together', () => {
    expect(() => parseBody('phases', null, 'create')).toThrow(BadRequestException);
    expect(() => parseBody('phases', [], 'create')).toThrow(BadRequestException);
    try {
      parseBody('varieties', { ptype_id: 'PT-PADI', var_name: 'X', hacker: 1, var_tbase: 'panas', var_maturity: 0, var_release_year: 2020.5 }, 'create');
      fail('should throw');
    } catch (e: any) {
      expect(e.message).toMatch(/hacker: tidak dikenali/);
      expect(e.message).toMatch(/var_tbase: harus berupa angka/);
      expect(e.message).toMatch(/var_maturity: minimal 1/);
      expect(e.message).toMatch(/var_release_year: harus bilangan bulat/);
    }
  });

  it('requires mandatory fields on create only', () => {
    expect(() => parseBody('phases', { phase_name: 'X' }, 'create')).toThrow(/ptype_id: wajib diisi.*phase_seq: wajib diisi/);
    expect(() => parseBody('phases', { phase_name: 'X' }, 'update')).not.toThrow();
  });

  it('trims strings, lets "" or null clear optional fields, refuses to clear required ones', () => {
    expect(parseBody('plant-types', { ptype_name: '  Padi  ', ptype_latin: '', ptype_desc: null }, 'update')).toEqual({
      ptype_name: 'Padi',
      ptype_latin: null,
      ptype_desc: null,
    });
    expect(() => parseBody('plant-types', { ptype_name: '   ' }, 'update')).toThrow(/tidak boleh kosong/);
    expect(() => parseBody('plant-types', { ptype_name: null }, 'update')).toThrow(/tidak boleh kosong/);
  });

  it('checks enums, string length and materials 0-100', () => {
    expect(() => parseBody('plant-types', { ptype_age_unit: 'YEAR' }, 'update')).toThrow(/DAY, MONTH/);
    expect(() => parseBody('plant-types', { ptype_name: 'x'.repeat(65) }, 'update')).toThrow(/maksimal 64/);
    expect(() => parseBody('materials', { mat_n: 101 }, 'update')).toThrow(/maksimal 100/);
    expect(() => parseBody('materials', { mat_n: -1 }, 'update')).toThrow(/minimal 0/);
    expect(parseBody('materials', { mat_n: 46, mat_p2o5: 0 }, 'update')).toEqual({ mat_n: 46, mat_p2o5: 0 });
  });

  it('ignores the id key (handled by the service) and rejects non-finite numbers', () => {
    expect(parseBody('units', { id: 'UNIT-X', unit_name: 'X' }, 'create')).toEqual({ unit_name: 'X' });
    expect(() => parseBody('varieties', { var_tbase: Infinity }, 'update')).toThrow();
  });
});

describe('cross-field rules', () => {
  it('phase end must be after start', () => {
    expect(RULES.phases({ phase_start_age: 10, phase_end_age: 10 })).toHaveLength(1);
    expect(RULES.phases({ phase_start_age: 10, phase_end_age: 22 })).toEqual([]);
    expect(RULES.phases({ phase_start_age: 94, phase_end_age: null })).toEqual([]);
  });

  it('variety: Tbase <= Topt <= Tmax, avg yield <= potential, nursery <= maturity', () => {
    expect(RULES.varieties({ var_tbase: 10, var_topt: 30, var_tmax: 42 })).toEqual([]);
    expect(RULES.varieties({ var_tbase: 31, var_topt: 30, var_tmax: 42 })).toHaveLength(1);
    expect(RULES.varieties({ var_yield_avg: 9, var_yield_potential: 8 })).toHaveLength(1);
    expect(RULES.varieties({ var_nursery_age: 130, var_maturity: 120 })).toHaveLength(1);
  });

  it('variety phase: age and GDD ranges must be increasing', () => {
    expect(RULES['variety-phases']({ vp_start_age: 12, vp_end_age: 26, vp_gdd_start: 204, vp_gdd_end: 442 })).toEqual([]);
    expect(RULES['variety-phases']({ vp_start_age: 26, vp_end_age: 12 })).toHaveLength(1);
    expect(RULES['variety-phases']({ vp_gdd_start: 442, vp_gdd_end: 204 })).toHaveLength(1);
  });

  describe('phase thresholds: warning limits inside critical limits', () => {
    const ok = { ppp_min_norm_value: 40, ppp_min_val_warn: 50, ppp_norm_value: 80, ppp_max_val_warn: 95, ppp_max_norm_value: 99 };
    it('accepts the seed rows (including warn == critical)', () => {
      expect(RULES['phase-params'](ok)).toEqual([]);
      expect(RULES['phase-params']({ ppp_min_norm_value: 55, ppp_min_val_warn: 70, ppp_norm_value: 95, ppp_max_val_warn: 101, ppp_max_norm_value: 101 })).toEqual([]);
    });

    it.each([
      ['warning below critical (min)', { ppp_min_val_warn: 30 }],
      ['warning above critical (max)', { ppp_max_val_warn: 120 }],
      ['normal outside the warning band', { ppp_norm_value: 99.5 }],
      ['inverted warning band', { ppp_min_val_warn: 96 }],
    ])('rejects %s', (_n, over) => {
      expect(RULES['phase-params']({ ...ok, ...over })).toHaveLength(1);
    });

    it('only compares the values that are set', () => {
      expect(RULES['phase-params']({ ppp_min_norm_value: 40, ppp_max_norm_value: 99 })).toEqual([]);
      expect(RULES['phase-params']({ ppp_min_norm_value: 99, ppp_max_norm_value: 40 })).toHaveLength(1);
    });
  });

  it('telemetry values must be numeric text in order', () => {
    expect(RULES.telemetry({ kt_min_value: '15', kt_min_value_warn: '20', kt_norm_value: '28', kt_max_value_warn: '35', kt_max_value: '40' })).toEqual([]);
    expect(RULES.telemetry({ kt_min_value: 'dingin' })[0]).toMatch(/angka/);
    expect(RULES.telemetry({ kt_min_value: '40', kt_max_value: '15' })).toHaveLength(1);
    expect(RULES.telemetry({})).toEqual([]);
  });
});

describe('write permissions', () => {
  it('agronom edits commodity and thresholds only; admin everything; nobody else anything', () => {
    for (const r of ['plant-types', 'phases', 'varieties', 'variety-phases', 'phase-params']) {
      expect(WRITE_ROLES[r]).toEqual(['admin', 'agronom']);
    }
    for (const r of ['activity-types', 'materials', 'telemetry', 'units']) expect(WRITE_ROLES[r]).toEqual(['admin']);
  });

  it('controller admits only admin and agronom to the write routes', () => {
    for (const n of ['create', 'update', 'remove'] as const) {
      expect([...Reflect.getMetadata(ROLES_KEY, RefController.prototype[n])].sort()).toEqual(['admin', 'agronom']);
    }
  });
});

// ---------------------------------------------------------------------------- service

const eq = (row: any, where: Record<string, any>) => Object.entries(where).every(([k, v]) => row[k] === v);

function setup(seed: Record<string, any[]> = {}) {
  const tables = new Map<unknown, any[]>([
    [PlantType, [{ ptype_id: 'PT-PADI', ptype_name: 'Padi' }]],
    [PlantPhase, [
      { phase_id: 'P1', ptype_id: 'PT-PADI', phase_name: 'Semai', phase_start_age: -21, phase_end_age: 0 },
      { phase_id: 'P2', ptype_id: 'PT-PADI', phase_name: 'Awal', phase_start_age: 0, phase_end_age: 10 },
      { phase_id: 'P3', ptype_id: 'PT-PADI', phase_name: 'Akhir', phase_start_age: 94, phase_end_age: null },
    ]],
    [PlantVariety, [{ var_id: 'V1', ptype_id: 'PT-PADI' }]],
    [VarietyPhase, [{ vp_id: 'VP1', var_id: 'V1', phase_id: 'P2', vp_source: 'ESTIMASI' }, { vp_id: 'VP2', var_id: 'V1', phase_id: 'P3', vp_source: 'KALIBRASI' }]],
    [TelemetryCode, [{ kt_id: 'KT-A', kt_name: 'A' }]],
    [Unit, [{ unit_id: 'UNIT-KG', unit_name: 'Kilogram' }]],
    [DeviceSensor, []],
  ]);
  for (const [name, rows] of Object.entries(seed)) {
    const entity = { phases: PlantPhase, telemetry: TelemetryCode, 'device-sensor': DeviceSensor, 'variety-phases': VarietyPhase }[name];
    if (entity) tables.set(entity, rows);
  }
  const failures: { insert?: any; delete?: any } = {};
  const repoOf = (entity: unknown) => ({
    findOne: jest.fn(async ({ where }) => (tables.get(entity) ?? []).find((r) => eq(r, where)) ?? null),
    find: jest.fn(async ({ where }) => (tables.get(entity) ?? []).filter((r) => eq(r, where))),
    count: jest.fn(async ({ where }) => (tables.get(entity) ?? []).filter((r) => eq(r, where)).length),
    insert: jest.fn(async (row) => {
      if (failures.insert) throw failures.insert;
      tables.get(entity)!.push({ ...row });
    }),
    update: jest.fn(async (where, patch) => {
      (tables.get(entity) ?? []).filter((r) => eq(r, where)).forEach((r) => Object.assign(r, patch));
    }),
    delete: jest.fn(async (where) => {
      if (failures.delete) throw failures.delete;
      const list = tables.get(entity)!;
      const i = list.findIndex((r) => eq(r, where));
      if (i >= 0) list.splice(i, 1);
    }),
  });
  const repos = new Map<unknown, ReturnType<typeof repoOf>>();
  const getRepository = (entity: unknown) => {
    if (!repos.has(entity)) repos.set(entity, repoOf(entity));
    return repos.get(entity)!;
  };
  const service = new RefService({ manager: { getRepository } } as any);
  return { service, tables, failures, getRepository };
}

describe('RefService writes: permissions', () => {
  it('forbids a tenant admin entirely, and an agronom on admin-only tables', async () => {
    const { service } = setup();
    await expect(service.create(tenantAdmin, 'plant-types', { id: 'PT-X', ptype_name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(agronom, 'materials', { id: 'MAT-X', mat_name: 'X' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(agronom, 'telemetry', 'KT-A', { kt_name: 'B' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(agronom, 'units', 'UNIT-KG')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s for an unknown resource before anything else', async () => {
    const { service } = setup();
    await expect(service.create(admin, 'nope', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes an audit line without leaking values', async () => {
    const { service } = setup();
    const log = jest.spyOn((service as any).audit, 'log').mockImplementation(() => undefined);
    await service.create(admin, 'units', { id: 'UNIT-NEW', unit_name: 'Baru' });
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ action: 'create', resource: 'units', id: 'UNIT-NEW', user_id: 'ga', role: 'admin' });
  });
});

describe('RefService.create', () => {
  it('creates a row with the id and update stamp', async () => {
    const { service, tables } = setup();
    const row = await service.create(admin, 'units', { id: 'UNIT-NEW', unit_name: 'Baru', unit_symbol: 'bru' });
    expect(row).toMatchObject({ unit_id: 'UNIT-NEW', unit_name: 'Baru' });
    expect((row as any).unit_update).toBeInstanceOf(Date);
    expect(tables.get(Unit)).toHaveLength(2);
  });

  it.each([undefined, '', 'lowercase', 'HAS SPACE', 'BAD$', 'X'.repeat(33)])('requires a valid id (got %p)', async (id) => {
    const { service } = setup();
    await expect(service.create(admin, 'units', { id, unit_name: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a 64-char id for telemetry and generates ids for variety-phases/phase-params', async () => {
    const { service } = setup();
    await expect(service.create(admin, 'telemetry', { id: 'KT-' + 'A'.repeat(61), kt_name: 'Long' })).resolves.toBeDefined();
    const vp = (await service.create(admin, 'variety-phases', { var_id: 'V1', phase_id: 'P1', vp_start_age: 0, vp_end_age: 5 })) as any;
    expect(vp.vp_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('409s on an existing id and on a duplicate unique pair from the database', async () => {
    const { service, failures } = setup();
    await expect(service.create(admin, 'units', { id: 'UNIT-KG', unit_name: 'Dup' })).rejects.toBeInstanceOf(ConflictException);
    failures.insert = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    await expect(service.create(admin, 'variety-phases', { var_id: 'V1', phase_id: 'P1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects references that do not exist', async () => {
    const { service } = setup();
    await expect(service.create(admin, 'phases', { id: 'P9', ptype_id: 'PT-NOPE', phase_name: 'X', phase_seq: 1 })).rejects.toThrow(/ptype_id/);
    await expect(service.create(admin, 'variety-phases', { var_id: 'V9', phase_id: 'P1' })).rejects.toThrow(/var_id/);
    await expect(service.create(admin, 'materials', { id: 'MAT-X', mat_name: 'X', unit_id: 'UNIT-NOPE' })).rejects.toThrow(/unit_id/);
  });

  describe('phase overlap', () => {
    const create = (service: RefService, start: number, end: number | null) =>
      service.create(admin, 'phases', { id: 'PNEW', ptype_id: 'PT-PADI', phase_name: 'Baru', phase_seq: 4, phase_start_age: start, phase_end_age: end });

    it('accepts a phase that touches its neighbours', async () => {
      const { service } = setup();
      await expect(create(service, 10, 29)).resolves.toBeDefined();
    });

    it.each([
      [5, 15],
      [-30, -10],
      [90, null],
      [-100, null],
    ])('rejects %s..%s', async (start, end) => {
      const { service } = setup();
      await expect(create(service, start, end)).rejects.toThrow(/tumpang tindih/);
    });
  });

  it('only an agronom may set the KALIBRASI source', async () => {
    const { service } = setup();
    const body = { var_id: 'V1', phase_id: 'P1', vp_source: 'KALIBRASI' };
    await expect(service.create(admin, 'variety-phases', body)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(agronom, 'variety-phases', body)).resolves.toBeDefined();
  });
});

describe('RefService.update', () => {
  it('changes values, stamps the update column and returns the merged row', async () => {
    const { service, tables } = setup();
    const row = (await service.update(admin, 'units', 'UNIT-KG', { unit_name: 'Kilo' })) as any;
    expect(row).toMatchObject({ unit_id: 'UNIT-KG', unit_name: 'Kilo' });
    expect(tables.get(Unit)![0].unit_update).toBeInstanceOf(Date);
  });

  it('does not stamp telemetry (no update column)', async () => {
    const { service, tables } = setup();
    await service.update(admin, 'telemetry', 'KT-A', { kt_name: 'B' });
    expect(tables.get(TelemetryCode)![0]).not.toHaveProperty('kt_update');
  });

  it('refuses empty updates and 404s for a missing row', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'units', 'UNIT-KG', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(admin, 'units', 'UNIT-NOPE', { unit_name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps identifying keys fixed but accepts them unchanged', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'variety-phases', 'VP1', { phase_id: 'P1' })).rejects.toThrow(/tidak bisa diubah/);
    await expect(service.update(admin, 'variety-phases', 'VP1', { phase_id: 'P2', vp_note: 'ok' })).resolves.toBeDefined();
    await expect(service.update(admin, 'phases', 'P2', { ptype_id: 'PT-OTHER' })).rejects.toThrow(/tidak bisa diubah/);
  });

  it('validates cross-field rules on the merged row', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'phases', 'P2', { phase_end_age: 0 })).rejects.toThrow(/lebih besar/);
  });

  it('checks overlap against other phases but not against itself', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'phases', 'P2', { phase_end_age: 11, phase_name: 'Ubah' })).resolves.toBeDefined();
    await expect(service.update(admin, 'phases', 'P2', { phase_start_age: -5 })).rejects.toThrow(/tumpang tindih/);
  });

  it('KALIBRASI rules: an agronom sets it, an admin may keep editing an already calibrated row', async () => {
    const { service } = setup();
    await expect(service.update(admin, 'variety-phases', 'VP1', { vp_source: 'KALIBRASI' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(agronom, 'variety-phases', 'VP1', { vp_source: 'KALIBRASI' })).resolves.toBeDefined();
    await expect(service.update(admin, 'variety-phases', 'VP2', { vp_source: 'KALIBRASI', vp_note: 'koreksi' })).resolves.toBeDefined();
  });
});

describe('RefService.remove', () => {
  it('deletes an unused row', async () => {
    const { service, tables } = setup();
    await service.remove(admin, 'units', 'UNIT-KG');
    expect(tables.get(Unit)).toHaveLength(0);
  });

  it('refuses a telemetry code used by a sensor', async () => {
    const { service, tables } = setup({ 'device-sensor': [{ ds_id: 'D1', kt_id: 'KT-A' }] });
    await expect(service.remove(admin, 'telemetry', 'KT-A')).rejects.toBeInstanceOf(ConflictException);
    expect(tables.get(TelemetryCode)).toHaveLength(1);
  });

  it('turns a foreign-key error into 409 and 404s for a missing row', async () => {
    const { service, failures } = setup();
    failures.delete = Object.assign(new Error('fk'), { code: 'ER_ROW_IS_REFERENCED_2' });
    await expect(service.remove(admin, 'units', 'UNIT-KG')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove(admin, 'units', 'UNIT-NOPE')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rethrows unexpected database errors untouched', async () => {
    const { service, failures } = setup();
    failures.delete = new Error('boom');
    await expect(service.remove(admin, 'units', 'UNIT-KG')).rejects.toThrow('boom');
  });
});
