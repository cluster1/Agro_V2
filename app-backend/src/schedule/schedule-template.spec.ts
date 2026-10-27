import { buildTemplateSchedules, TEMPLATE_ACTIVITIES } from './schedule-template';

const phases = [
  { phase_id: 'PH-PADI-01', phase_code: 'SEMAI', phase_seq: 1, phase_start_age: -21, phase_end_age: 0 },
  { phase_id: 'PH-PADI-02', phase_code: 'VEG-AWAL', phase_seq: 2, phase_start_age: 0, phase_end_age: 10 },
  { phase_id: 'PH-PADI-03', phase_code: 'ANAKAN', phase_seq: 3, phase_start_age: 10, phase_end_age: 22 },
  { phase_id: 'PH-PADI-04', phase_code: 'ANAK-MAX', phase_seq: 4, phase_start_age: 22, phase_end_age: 29 },
  { phase_id: 'PH-PADI-05', phase_code: 'PRIMORDIA', phase_seq: 5, phase_start_age: 29, phase_end_age: 44 },
  { phase_id: 'PH-PADI-09', phase_code: 'KUNING', phase_seq: 9, phase_start_age: 77, phase_end_age: 87 },
  { phase_id: 'PH-PADI-11', phase_code: 'BERA', phase_seq: 11, phase_start_age: 94, phase_end_age: null },
] as any[];

const type = (actype_id: string, actype_name: string, unit_id: string | null = null) =>
  ({ actype_id, actype_name, unit_id }) as any;

const activityTypes = [
  type('ACT-PD-PUPUK-DASAR', 'Pemupukan Dasar', 'UNIT-KG'),
  type('ACT-PD-PUPUK-S1', 'Pemupukan Susulan I', 'UNIT-KG'),
  type('ACT-PD-PUPUK-S2', 'Pemupukan Susulan II', 'UNIT-KG'),
  type('ACT-PD-BWD', 'Pengukuran Bagan Warna Daun (BWD)', 'UNIT-NONE'),
  type('ACT-PD-DRAIN', 'Pengeringan Menjelang Panen'),
  type('ACT-PD-PANEN', 'Panen Padi', 'UNIT-KG'),
];

const plant = {
  plant_id: 'C1_PLT1',
  tenant_id: 'T1',
  site_id: 'S1',
  cluster_id: 'C1',
  plant_sow_date: '2026-08-25',
  plant_date: '2026-09-15',
};

const build = (over: Partial<Parameters<typeof buildTemplateSchedules>[0]> = {}) =>
  buildTemplateSchedules({
    plant,
    variety: { var_maturity: 120 },
    phases,
    varietyPhases: [],
    activityTypes,
    userId: 'u1',
    now: new Date('2026-09-01T00:00:00Z'),
    ...over,
  });

const byType = (rows: any[], id: string) => rows.find((r) => r.actype_id === id);
const day = (r: any) => String(r.sched_start_date).slice(0, 10);

describe('buildTemplateSchedules (Inpari 32, tanam 2026-09-15)', () => {
  const rows = build();

  it('creates the six template items', () => {
    expect(rows.map((r) => r.actype_id).sort()).toEqual(Object.values(TEMPLATE_ACTIVITIES).sort());
  });

  it('places fertilising on HST 0, 14 and at the start of primordia (HST 29)', () => {
    expect(day(byType(rows, 'ACT-PD-PUPUK-DASAR'))).toBe('2026-09-15');
    expect(day(byType(rows, 'ACT-PD-PUPUK-S1'))).toBe('2026-09-29');
    expect(day(byType(rows, 'ACT-PD-PUPUK-S2'))).toBe('2026-10-14');
  });

  it('uses the variety phase start instead of the generic one when the variety has it', () => {
    const custom = build({
      varietyPhases: [{ phase_id: 'PH-PADI-05', vp_start_age: 33 } as any],
    });
    expect(day(byType(custom, 'ACT-PD-PUPUK-S2'))).toBe('2026-10-18');
  });

  it('makes BWD one weekly recurring parent from HST 14 until HST 62', () => {
    const bwd = byType(rows, 'ACT-PD-BWD');
    expect(day(bwd)).toBe('2026-09-29');
    expect(bwd).toMatchObject({ sched_repeat: 'WEEKLY', sched_interval: 1, sched_repeat_until: '2026-11-16' });
  });

  it('dries at early yellow ripening (HST 77)', () => {
    expect(day(byType(rows, 'ACT-PD-DRAIN'))).toBe('2026-12-01');
  });

  it('harvests at maturity counted from sowing (HSS 120 -> 2026-12-23)', () => {
    const harvest = byType(rows, 'ACT-PD-PANEN');
    expect(day(harvest)).toBe('2026-12-23');
    expect(harvest.sched_desc).toBe('HST 99');
  });

  it('falls back to 115 HSS without a maturity', () => {
    const harvest = byType(build({ variety: { var_maturity: null as any } }), 'ACT-PD-PANEN');
    expect(day(harvest)).toBe('2026-12-18');
  });

  it('stamps every row with tenant, plant, TEMPLATE source, planned status and a generic phase', () => {
    for (const r of rows) {
      expect(r).toMatchObject({
        tenant_id: 'T1',
        site_id: 'S1',
        cluster_id: 'C1',
        plant_id: 'C1_PLT1',
        user_id: 'u1',
        sched_source: 'TEMPLATE',
        sched_sts: 0,
      });
      expect(r.sched_id).toMatch(/^[0-9a-f]{32}$/);
      expect(r.phase_id).toBeDefined();
    }
    expect(byType(rows, 'ACT-PD-PUPUK-S2').phase_id).toBe('PH-PADI-05');
    expect(new Set(rows.map((r) => r.sched_id)).size).toBe(rows.length);
  });

  it('copies the default unit of the activity type', () => {
    expect(byType(rows, 'ACT-PD-PUPUK-DASAR').unit_id).toBe('UNIT-KG');
    expect(byType(rows, 'ACT-PD-DRAIN').unit_id).toBeUndefined();
  });

  it('skips items whose activity type does not exist', () => {
    const partial = build({ activityTypes: activityTypes.filter((t) => t.actype_id !== 'ACT-PD-BWD') });
    expect(partial.map((r) => r.actype_id)).not.toContain('ACT-PD-BWD');
    expect(partial).toHaveLength(5);
  });
});
