import { dailyGdd, phaseOn, projectTimeline, TimelineInput, WeatherDay } from './phase-engine';
import { buildCurves, growthIndex, interpolate } from './growth-engine';
import { advice, hasAdvice, nitrogenDeficit, pkDeficit, seasonOf } from './nutrient-engine';
import { nFactor, pestFactor, predictYield } from './yield-engine';

// Inpari 32 HDB, seeded in MyAssets/SQl_V2_NEW.SQL: (code, seq, startAge, gddStart, height, tiller, bwdMin)
const SEED: [string, number, number, number, number | null, number | null, number | null][] = [
  ['SEMAI', 1, -21, -357, 19.4, 1, null],
  ['VEG-AWAL', 2, 0, 0, 29.1, 5.9, null],
  ['ANAKAN', 3, 12, 204, 48.5, 17.6, 4],
  ['ANAK-MAX', 4, 26, 442, 60.1, 23.4, 4],
  ['PRIMORDIA', 5, 34, 578, 75.7, 21.1, 4],
  ['BUNTING', 6, 49, 833, 89.2, 18, 4],
  ['BUNGA', 7, 62, 1054, 97, 18, null],
  ['SUSU', 8, 72, 1224, 97, 18, null],
  ['KUNING', 9, 82, 1394, 97, 18, null],
  ['PANEN', 10, 92, 1564, 97, 18, null],
  ['BERA', 11, 99, 1683, 97, 18, null],
];

const phases = SEED.map(([code, seq, start]) => ({
  phase_id: `PH-${code}`,
  phase_code: code,
  phase_name: code,
  phase_seq: seq,
  phase_start_age: start,
  phase_end_age: null,
}));

const varietyPhases = SEED.map(([code, , start, gdd, h, t, bwd], i) => ({
  phase_id: `PH-${code}`,
  vp_start_age: start,
  vp_end_age: SEED[i + 1]?.[2] ?? null,
  vp_gdd_start: gdd,
  vp_gdd_end: SEED[i + 1]?.[3] ?? null,
  vp_height_ref: h,
  vp_tiller_ref: t,
  vp_bwd_min: bwd,
}));

// constant 22/32 °C: (22 + min(32, 42)) / 2 - 10 = 17 GDD/day, so GDD = 17 x age exactly
const steady = (type: WeatherDay['type'] = 'NORMAL') => (): WeatherDay => ({ tmin: 22, tmax: 32, type });

const base = (over: Partial<TimelineInput> = {}): TimelineInput => ({
  sowDate: '2026-08-25',
  plantDate: '2026-09-15',
  today: '2026-10-24',
  tbase: 10,
  tmaxVar: 42,
  phases,
  varietyPhases,
  weatherFor: steady(),
  ...over,
});

describe('dailyGdd', () => {
  it('averages min and capped max over the base temperature', () => {
    expect(dailyGdd(22, 32, 10, 42)).toBe(17);
    expect(dailyGdd(22, 50, 10, 42)).toBe(22); // Tmax capped at the variety limit: (22+42)/2 - 10
  });
  it('is never negative', () => {
    expect(dailyGdd(5, 12, 10, 42)).toBe(0);
  });
});

describe('projectTimeline (GDD)', () => {
  const t = projectTimeline(base());
  const by = (code: string) => t.phases.find((p) => p.phase_code === code)!;

  it('reproduces the seeded Inpari 32 schedule of the demo run', () => {
    expect(t.method).toBe('GDD');
    expect(by('SEMAI').start_date).toBe('2026-08-25');
    expect(by('VEG-AWAL').start_date).toBe('2026-09-15');
    expect(by('ANAKAN').start_date).toBe('2026-09-27');
    expect(by('ANAK-MAX').start_date).toBe('2026-10-11');
    expect(by('PRIMORDIA').start_date).toBe('2026-10-19');
    expect(by('BUNTING').start_date).toBe('2026-11-03');
    expect(by('BUNGA').start_date).toBe('2026-11-16');
    expect(by('SUSU').start_date).toBe('2026-11-26');
    expect(by('KUNING').start_date).toBe('2026-12-06');
    expect(by('PANEN').start_date).toBe('2026-12-16');
    expect(by('BERA').start_date).toBe('2026-12-23');
    expect(t.harvest_date).toBe('2026-12-23');
  });

  it('ends each phase the day before the next starts and leaves the last open', () => {
    expect(by('SEMAI').end_date).toBe('2026-09-14');
    expect(by('ANAKAN').end_date).toBe('2026-10-10');
    expect(by('BERA').end_date).toBeNull();
  });

  it('reports ages relative to planting and keeps the planned GDD', () => {
    expect(by('SEMAI')).toMatchObject({ start_age: -21, gdd_start: -357 });
    expect(by('PRIMORDIA')).toMatchObject({ start_age: 34, gdd_start: 578 });
  });

  it('labels the data type by weather source of the start day', () => {
    const mixed = projectTimeline(
      base({
        weatherFor: (day) => ({ tmin: 22, tmax: 32, type: day < '2026-10-24' ? 'ACTUAL' : day < '2026-11-07' ? 'FORECAST' : 'NORMAL' }),
      }),
    );
    const type = (c: string) => mixed.phases.find((p) => p.phase_code === c)!.data_type;
    expect(type('SEMAI')).toBe('ACTUAL');
    expect(type('ANAKAN')).toBe('ACTUAL');
    expect(type('PRIMORDIA')).toBe('ACTUAL'); // 10-19 is before today
    expect(type('BUNTING')).toBe('FORECAST'); // 11-03
    expect(type('BUNGA')).toBe('NORMAL'); // 11-16
  });

  it('a cooler season delays the phases and a warmer one hastens them', () => {
    const cool = projectTimeline(base({ weatherFor: () => ({ tmin: 20, tmax: 30, type: 'NORMAL' }) })); // 15 GDD/day
    const warm = projectTimeline(base({ weatherFor: () => ({ tmin: 24, tmax: 34, type: 'NORMAL' }) })); // 19 GDD/day
    const harvest = (r: typeof cool) => r.harvest_date!;
    expect(harvest(cool) > '2026-12-23').toBe(true);
    expect(harvest(warm) < '2026-12-23').toBe(true);
  });
});

describe('projectTimeline (fallbacks)', () => {
  it('falls back to days after planting when weather runs out', () => {
    const t = projectTimeline(base({ weatherFor: (d) => (d < '2026-10-01' ? { tmin: 22, tmax: 32, type: 'ACTUAL' } : null) }));
    expect(t.method).toBe('HST');
    expect(t.phases.find((p) => p.phase_code === 'BERA')!.start_date).toBe('2026-12-23');
    expect(t.phases.find((p) => p.phase_code === 'SEMAI')!.start_date).toBe('2026-08-25');
  });

  it('uses age when the variety has no GDD limits', () => {
    const noGdd = varietyPhases.map((v) => ({ ...v, vp_gdd_start: null, vp_gdd_end: null }));
    const t = projectTimeline(base({ varietyPhases: noGdd }));
    expect(t.method).toBe('HST');
    expect(t.phases.find((p) => p.phase_code === 'ANAKAN')!.start_date).toBe('2026-09-27');
  });

  it('uses the generic phases when the variety has no rows', () => {
    const t = projectTimeline(base({ varietyPhases: [] }));
    expect(t.method).toBe('HST');
    expect(t.phases).toHaveLength(11);
    expect(t.phases[2].start_date).toBe('2026-09-27'); // generic start age 12
  });

  it('returns nothing without phases', () => {
    expect(projectTimeline(base({ phases: [] }))).toEqual({ method: 'HST', phases: [], harvest_date: null });
  });
});

describe('phaseOn', () => {
  const t = projectTimeline(base());
  it('picks the phase in effect on a day', () => {
    expect(phaseOn(t.phases, '2026-10-24')!.phase_code).toBe('PRIMORDIA');
    expect(phaseOn(t.phases, '2026-10-19')!.phase_code).toBe('PRIMORDIA');
    expect(phaseOn(t.phases, '2026-10-18')!.phase_code).toBe('ANAK-MAX');
    expect(phaseOn(t.phases, '2030-01-01')!.phase_code).toBe('BERA');
  });
  it('is the first phase before anything started and undefined for no phases', () => {
    expect(phaseOn(t.phases, '2020-01-01')!.phase_code).toBe('SEMAI');
    expect(phaseOn([], '2026-10-24')).toBeUndefined();
  });
});

describe('growth', () => {
  const curve = buildCurves(varietyPhases.map((v) => ({ end_age: v.vp_end_age, height: v.vp_height_ref, tiller: v.vp_tiller_ref })));

  it('interpolates linearly between phase-end points, ramps from 0, then stays flat', () => {
    const pts = [{ age: 10, value: 20 }, { age: 20, value: 40 }];
    expect(interpolate(pts, 0)).toBe(0);
    expect(interpolate(pts, 5)).toBe(10);
    expect(interpolate(pts, 15)).toBe(30);
    expect(interpolate(pts, 99)).toBe(40);
    expect(interpolate([], 5)).toBeNull();
  });

  it('GI is the mean of the two ratios, each capped at 1', () => {
    const ref = (age: number) => ({
      h: interpolate(curve.height, age)!,
      t: interpolate(curve.tiller, age)!,
    });
    const { h, t } = ref(27);
    const full = growthIndex({ height: h, tiller: t }, 27, curve);
    expect(full.index).toBe(1);
    const half = growthIndex({ height: h / 2, tiller: t * 2 }, 27, curve); // 0.5 and capped 1
    expect(half.index).toBe(0.75);
  });

  it('flags stunted growth below 0.85', () => {
    const { h, t } = { h: interpolate(curve.height, 27)!, t: interpolate(curve.tiller, 27)! };
    expect(growthIndex({ height: h * 0.8, tiller: t * 0.8 }, 27, curve)).toMatchObject({ index: 0.8, stunted: true });
    expect(growthIndex({ height: h * 0.9, tiller: t * 0.9 }, 27, curve)).toMatchObject({ index: 0.9, stunted: false });
  });

  it('uses the one measured value, and gives no index without observation', () => {
    const h = interpolate(curve.height, 27)!;
    expect(growthIndex({ height: h * 0.5, tiller: null }, 27, curve).index).toBe(0.5);
    expect(growthIndex({ height: null, tiller: null }, 27, curve)).toMatchObject({ index: null, note: 'perlu observasi' });
    expect(growthIndex(null, 27, curve)).toMatchObject({ index: null, stunted: false, note: 'perlu observasi' });
  });
});

describe('nitrogen deficit (F-MDL-03)', () => {
  it('BWD 3 under the limit 4 in the rainy season: urea 50 kg/ha = 23 kg N (demo run)', () => {
    expect(nitrogenDeficit(3, 4, 10)).toMatchObject({ n_def: 23, urea_dose: 50, applicable: true });
  });
  it('dry season asks for 75 kg urea = 34.5 kg N', () => {
    expect(nitrogenDeficit(3, 4, 7)).toMatchObject({ n_def: 34.5, urea_dose: 75 });
  });
  it('is zero at or above the limit, without a BWD, or in phases with no limit', () => {
    expect(nitrogenDeficit(4, 4, 10).n_def).toBe(0);
    expect(nitrogenDeficit(4.5, 4, 10).n_def).toBe(0);
    expect(nitrogenDeficit(null, 4, 10)).toMatchObject({ n_def: 0, applicable: true });
    expect(nitrogenDeficit(2, null, 10)).toMatchObject({ n_def: 0, applicable: false });
  });
  it('maps months to seasons', () => {
    expect([10, 11, 12, 1, 2, 3].map(seasonOf)).toEqual(Array(6).fill('RAINY'));
    expect([4, 5, 6, 7, 8, 9].map(seasonOf)).toEqual(Array(6).fill('DRY'));
  });
});

describe('P and K deficit (F-MDL-04)', () => {
  const inputs = { n_kg_ha: 15, p2o5_kg_ha: 15, k2o_kg_ha: 15 }; // 200 kg NPK 15-15-15 on 2 ha

  it('demo run: SEDANG/SEDANG with 15 kg input leaves P2O5 12 and K2O 15', () => {
    const r = pkDeficit('SEDANG', 'SEDANG', inputs);
    expect(r).toMatchObject({ p_rec: 27, k_rec: 30, p_def: 12, k_def: 15, assumed: false });
  });

  it('recommends more on poor soil and less on rich soil', () => {
    expect(pkDeficit('RENDAH', 'RENDAH', { n_kg_ha: 0, p2o5_kg_ha: 0, k2o_kg_ha: 0 })).toMatchObject({ p_rec: 36, k_rec: 60 });
    expect(pkDeficit('TINGGI', 'TINGGI', { n_kg_ha: 0, p2o5_kg_ha: 0, k2o_kg_ha: 0 })).toMatchObject({ p_rec: 18, k_rec: 30 });
  });

  it('never goes negative when inputs exceed the recommendation', () => {
    expect(pkDeficit('SEDANG', 'SEDANG', { n_kg_ha: 0, p2o5_kg_ha: 99, k2o_kg_ha: 99 })).toMatchObject({ p_def: 0, k_def: 0 });
  });

  it('assumes SEDANG without lab data and says so', () => {
    expect(pkDeficit(null, undefined, inputs)).toMatchObject({ p_status: 'SEDANG', k_status: 'SEDANG', assumed: true });
    expect(pkDeficit('RENDAH', null, inputs).assumed).toBe(true);
  });
});

describe('fertiliser advice (F-MDL-05)', () => {
  it('converts deficits to kg of straight fertiliser per ha, rounding up', () => {
    expect(advice(23, 12, 15)).toEqual({ urea_kg_ha: 50, sp36_kg_ha: 34, kcl_kg_ha: 25 });
    expect(advice(0, 0, 0)).toEqual({ urea_kg_ha: 0, sp36_kg_ha: 0, kcl_kg_ha: 0 });
  });
  it('detects whether anything is advised', () => {
    expect(hasAdvice(advice(0, 0, 0))).toBe(false);
    expect(hasAdvice(advice(0, 0.1, 0))).toBe(true);
  });
});

describe('yield prediction (F-MDL-06)', () => {
  const pre = { phaseSeq: 5, avgYield: 6.3, potentialYield: 8.4, growthIndex: 0.97, bwd: 3, pestPct: 3.3, panicle: null, grain: null, filledPct: null, hillsPerHa: 213_333, grainWeight1000: 27 };

  it('factor tables', () => {
    expect([4, 4.5, 3.5, 3, 2.5, 2].map(nFactor)).toEqual([1, 1, 0.97, 0.95, 0.9, 0.9]);
    expect(nFactor(null)).toBe(1);
    expect(pestFactor(0)).toBe(1);
    expect(pestFactor(null)).toBe(1);
    expect(pestFactor(100)).toBe(0.7);
  });

  it('demo run: 6.3 x 0.97 x 0.95 x 0.99 = 5.7 t/ha, range 4.9-6.6, confidence 0.5', () => {
    const r = predictYield({ ...pre, pestPct: 3.3333 });
    expect(r).toMatchObject({ method: 'FAKTOR', value: 5.7, low: 4.9, high: 6.6, confidence: 0.5 });
    expect(r.factors).toMatchObject({ f_growth: 0.97, f_n: 0.95 });
  });

  it('missing growth index counts as 1 and is noted', () => {
    const r = predictYield({ ...pre, growthIndex: null, bwd: null, pestPct: null });
    expect(r.value).toBe(6.3);
    expect(r.note).toMatch(/observasi/);
  });

  it('component method after flowering: hills x panicles x grains x filled x 1000-grain weight', () => {
    // 250,000 hills x 14 panicles x 120 grains x 0.85 x 27 g / 1e9 = 9.64 t/ha
    const r = predictYield({
      ...pre,
      phaseSeq: 8,
      hillsPerHa: 250_000,
      panicle: 14,
      grain: 120,
      filledPct: 85,
    });
    expect(r).toMatchObject({ method: 'KOMPONEN', value: 9.6, low: 8.9, high: 10.4, confidence: 0.7 });
  });

  it('stays on the factor method before flowering or with incomplete components', () => {
    expect(predictYield({ ...pre, phaseSeq: 6, panicle: 14, grain: 120, filledPct: 85 }).method).toBe('FAKTOR');
    expect(predictYield({ ...pre, phaseSeq: 8, panicle: 14, grain: null, filledPct: 85 }).method).toBe('FAKTOR');
    expect(predictYield({ ...pre, phaseSeq: 8, panicle: 14, grain: 120, filledPct: 85, hillsPerHa: 0 }).method).toBe('FAKTOR');
  });

  it('has no value when the variety has no average yield', () => {
    expect(predictYield({ ...pre, avgYield: null })).toMatchObject({ value: null, low: null, high: null });
  });
});
