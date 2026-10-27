import { BadRequestException } from '@nestjs/common';

type FieldSpec =
  | { type: 'string'; max: number; required?: boolean }
  | { type: 'number'; min?: number; max?: number; required?: boolean }
  | { type: 'int'; min?: number; max?: number; required?: boolean }
  | { type: 'enum'; values: readonly string[]; required?: boolean };

export type Fields = Record<string, FieldSpec>;
export type Row = Record<string, unknown>;

const str = (max: number, required = false): FieldSpec => ({ type: 'string', max, required });
const num = (min?: number, max?: number, required = false): FieldSpec => ({ type: 'number', min, max, required });
const int = (min?: number, max?: number, required = false): FieldSpec => ({ type: 'int', min, max, required });
const pct = (): FieldSpec => num(0, 100);
const sts = (): FieldSpec => int(0, 1);

export const ID_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

/** Writable columns per resource (primary keys and *_update stamps are managed by the service). */
export const FIELDS: Record<string, Fields> = {
  'plant-types': {
    ptype_name: str(64, true),
    ptype_latin: str(128),
    ptype_category: str(32),
    ptype_lifespan: int(0, 1200),
    ptype_age_unit: { type: 'enum', values: ['DAY', 'MONTH'] },
    ptype_spacing: str(32),
    ptype_density: int(0, 10_000_000),
    ptype_icon: str(128),
    ptype_desc: str(255),
    ptype_sts: sts(),
  },
  phases: {
    ptype_id: str(32, true),
    phase_name: str(64, true),
    phase_code: str(16),
    phase_seq: int(1, 100, true),
    phase_start_age: int(-3650, 36500),
    phase_end_age: int(-3650, 36500),
    phase_color: str(16),
    phase_desc: str(255),
    phase_sts: sts(),
  },
  varieties: {
    ptype_id: str(32, true),
    var_name: str(64, true),
    var_code: str(32),
    var_origin: str(128),
    var_release_year: int(1900, 2200),
    var_maturity: int(1, 5000),
    var_nursery_age: int(0, 365),
    var_tbase: num(-10, 60),
    var_topt: num(-10, 60),
    var_tmax: num(-10, 70),
    var_height: num(0, 1000),
    var_tiller: num(0, 1000),
    var_grain_weight: num(0, 1000),
    var_yield_potential: num(0, 1000),
    var_yield_avg: num(0, 1000),
    unit_id: str(32),
    var_resistance: str(255),
    var_desc: str(255),
    var_sts: sts(),
  },
  'variety-phases': {
    var_id: str(32, true),
    phase_id: str(32, true),
    vp_start_age: int(-3650, 36500),
    vp_end_age: int(-3650, 36500),
    vp_gdd_start: num(0, 100_000),
    vp_gdd_end: num(0, 100_000),
    vp_height_ref: num(0, 1000),
    vp_tiller_ref: num(0, 1000),
    vp_bwd_min: num(2, 5),
    vp_source: { type: 'enum', values: ['ESTIMASI', 'LITERATUR', 'KALIBRASI'] },
    vp_note: str(255),
    vp_sts: sts(),
  },
  'phase-params': {
    phase_id: str(32, true),
    kt_id: str(64, true),
    unit_id: str(32),
    ppp_norm_value: num(),
    ppp_min_norm_value: num(),
    ppp_max_norm_value: num(),
    ppp_min_val_warn: num(),
    ppp_max_val_warn: num(),
    ppp_note: str(255),
    ppp_sts: sts(),
  },
  'activity-types': {
    ptype_id: str(32),
    actype_name: str(64, true),
    actype_category: str(32),
    unit_id: str(32),
    actype_need_photo: int(0, 1),
    actype_desc: str(255),
    actype_sts: sts(),
  },
  materials: {
    mat_name: str(64, true),
    mat_category: str(32),
    mat_brand: str(64),
    mat_active: str(128),
    mat_conc: str(32),
    mat_n: pct(),
    mat_p2o5: pct(),
    mat_k2o: pct(),
    mat_mgo: pct(),
    mat_cao: pct(),
    mat_s: pct(),
    mat_b: pct(),
    mat_c_org: pct(),
    unit_id: str(32),
    mat_desc: str(255),
    mat_sts: sts(),
  },
  telemetry: {
    kt_name: str(64, true),
    kt_norm_value: str(32),
    kt_min_value: str(32),
    kt_max_value: str(32),
    kt_min_value_warn: str(32),
    kt_max_value_warn: str(32),
    kt_sts: sts(),
  },
  units: {
    unit_name: str(64, true),
    unit_symbol: str(8),
    unit_sts: sts(),
  },
};

const isNil = (v: unknown) => v === undefined || v === null;

/**
 * Checks a request body against the resource's field table: unknown fields, types, ranges, enums and
 * (on create) required fields. Returns the cleaned values; '' and null clear an optional field.
 */
export function parseBody(resource: string, body: unknown, mode: 'create' | 'update'): Row {
  const fields = FIELDS[resource];
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Isi permintaan tidak valid');
  const input = body as Row;
  const errors: string[] = [];
  const out: Row = {};

  for (const key of Object.keys(input)) {
    if (key === 'id') continue;
    if (!fields[key]) errors.push(`${key}: tidak dikenali`);
  }

  for (const [key, spec] of Object.entries(fields)) {
    const raw = input[key];
    if (raw === undefined) {
      if (mode === 'create' && spec.required) errors.push(`${key}: wajib diisi`);
      continue;
    }
    if (raw === null || raw === '') {
      if (spec.required) errors.push(`${key}: tidak boleh kosong`);
      else out[key] = null;
      continue;
    }
    switch (spec.type) {
      case 'string':
        if (typeof raw !== 'string') errors.push(`${key}: harus berupa teks`);
        else if (raw.trim().length > spec.max) errors.push(`${key}: maksimal ${spec.max} karakter`);
        else if (spec.required && !raw.trim()) errors.push(`${key}: tidak boleh kosong`);
        else out[key] = raw.trim();
        break;
      case 'enum':
        if (typeof raw !== 'string' || !spec.values.includes(raw)) errors.push(`${key}: harus salah satu dari ${spec.values.join(', ')}`);
        else out[key] = raw;
        break;
      case 'number':
      case 'int': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) errors.push(`${key}: harus berupa angka`);
        else if (spec.type === 'int' && !Number.isInteger(raw)) errors.push(`${key}: harus bilangan bulat`);
        else if (spec.min !== undefined && raw < spec.min) errors.push(`${key}: minimal ${spec.min}`);
        else if (spec.max !== undefined && raw > spec.max) errors.push(`${key}: maksimal ${spec.max}`);
        else out[key] = raw;
        break;
      }
    }
  }

  if (errors.length) throw new BadRequestException(errors.join('; '));
  return out;
}

const n = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const notAfter = (a: number | undefined, b: number | undefined) => a === undefined || b === undefined || a <= b;

/** Cross-field rules on the merged row; each returns error messages. */
export const RULES: Record<string, (row: Row) => string[]> = {
  phases: (r) =>
    n(r.phase_start_age) !== undefined && n(r.phase_end_age) !== undefined && (r.phase_end_age as number) <= (r.phase_start_age as number)
      ? ['Umur akhir fase harus lebih besar dari umur awal']
      : [],
  varieties: (r) => {
    const e: string[] = [];
    if (!(notAfter(n(r.var_tbase), n(r.var_topt)) && notAfter(n(r.var_topt), n(r.var_tmax)))) {
      e.push('Suhu harus berurutan: Tbase <= Topt <= Tmax');
    }
    if (!notAfter(n(r.var_yield_avg), n(r.var_yield_potential))) e.push('Rata-rata hasil tidak boleh melebihi potensi hasil');
    if (!notAfter(n(r.var_nursery_age), n(r.var_maturity))) e.push('Umur bibit tidak boleh melebihi umur panen');
    return e;
  },
  'variety-phases': (r) => {
    const e: string[] = [];
    if (n(r.vp_start_age) !== undefined && n(r.vp_end_age) !== undefined && (r.vp_end_age as number) <= (r.vp_start_age as number)) {
      e.push('Umur akhir harus lebih besar dari umur awal');
    }
    if (n(r.vp_gdd_start) !== undefined && n(r.vp_gdd_end) !== undefined && (r.vp_gdd_end as number) <= (r.vp_gdd_start as number)) {
      e.push('GDD akhir harus lebih besar dari GDD awal');
    }
    return e;
  },
  // Warning limits sit inside the critical limits: min_norm <= min_warn <= norm <= max_warn <= max_norm
  'phase-params': (r) => {
    const chain: [string, number | undefined][] = [
      ['batas kritis bawah', n(r.ppp_min_norm_value)],
      ['batas peringatan bawah', n(r.ppp_min_val_warn)],
      ['nilai normal', n(r.ppp_norm_value)],
      ['batas peringatan atas', n(r.ppp_max_val_warn)],
      ['batas kritis atas', n(r.ppp_max_norm_value)],
    ];
    const set = chain.filter(([, v]) => v !== undefined) as [string, number][];
    for (let i = 1; i < set.length; i++) {
      if (set[i][1] < set[i - 1][1]) {
        return [`Urutan harus ${chain.map(([l]) => l).join(' <= ')}; ${set[i][0]} lebih kecil dari ${set[i - 1][0]}`];
      }
    }
    return [];
  },
  telemetry: (r) => {
    const e: string[] = [];
    const val = (k: string) => (isNil(r[k]) || r[k] === '' ? undefined : Number(r[k]));
    for (const k of ['kt_norm_value', 'kt_min_value', 'kt_max_value', 'kt_min_value_warn', 'kt_max_value_warn']) {
      if (val(k) !== undefined && !Number.isFinite(val(k))) e.push(`${k}: harus berupa angka`);
    }
    if (e.length) return e;
    const chain = [val('kt_min_value'), val('kt_min_value_warn'), val('kt_norm_value'), val('kt_max_value_warn'), val('kt_max_value')].filter(
      (v) => v !== undefined,
    ) as number[];
    for (let i = 1; i < chain.length; i++) {
      if (chain[i] < chain[i - 1]) return ['Urutan harus batas bawah <= peringatan bawah <= normal <= peringatan atas <= batas atas'];
    }
    return [];
  },
};

/** Roles allowed to change each resource (BRD menu matrix: agronom edits Komoditas and Ambang only). */
export const WRITE_ROLES: Record<string, readonly string[]> = {
  'plant-types': ['admin', 'agronom'],
  phases: ['admin', 'agronom'],
  varieties: ['admin', 'agronom'],
  'variety-phases': ['admin', 'agronom'],
  'phase-params': ['admin', 'agronom'],
  'activity-types': ['admin'],
  materials: ['admin'],
  telemetry: ['admin'],
  units: ['admin'],
};

/** Column stamped with the change time (the tables have no per-user column; audit goes to the log). */
export const UPDATE_STAMP: Record<string, string> = {
  'plant-types': 'ptype_update',
  phases: 'phase_update',
  varieties: 'var_update',
  'variety-phases': 'vp_update',
  'phase-params': 'ppp_update',
  'activity-types': 'actype_update',
  materials: 'mat_update',
  telemetry: '', // tr_kode_telemetri has no update column
  units: 'unit_update',
};

/** Resources whose primary key is generated when not supplied; others require `id`. */
export const GENERATED_ID = new Set(['variety-phases', 'phase-params']);
export const ID_MAX: Record<string, number> = { telemetry: 64 };
