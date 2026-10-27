/**
 * Konfigurasi halaman Master Data: satu definisi per resource /ref/*. Aturan lengkap tetap di backend
 * (rentang, urutan, tumpang tindih); di sini hanya label, kolom, dan jenis input.
 */

export type FieldKind = 'text' | 'number' | 'int' | 'enum' | 'ref'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  /** enum: nilai tetap; ref: resource sumber pilihan */
  options?: readonly string[]
  ref?: { resource: string; value: string; label: string; params?: Record<string, string> }
  /** hanya diisi saat membuat; tidak bisa diubah sesudahnya */
  createOnly?: boolean
}

export interface ColumnDef {
  key: string
  label: string
  align?: 'right'
  /** resource sumber untuk menampilkan nama dari id */
  lookup?: { resource: string; value: string; label: string }
  suffix?: string
}

export interface ResourceDef {
  resource: string
  group: string
  label: string
  /** kolom kunci utama pada baris */
  idKey: string
  /** id diisi pengguna (true) atau dibuat sistem */
  manualId: boolean
  idMax?: number
  idHint?: string
  columns: ColumnDef[]
  fields: FieldDef[]
  /** role yang boleh mengubah (cermin WRITE_ROLES backend) */
  writeRoles: readonly string[]
  /** parameter filter ptype default untuk daftar */
  listParams?: Record<string, string>
  note?: string
}

const PT = { resource: 'plant-types', value: 'ptype_id', label: 'ptype_name' }
const UNIT = { resource: 'units', value: 'unit_id', label: 'unit_name' }
const PHASE = { resource: 'phases', value: 'phase_id', label: 'phase_name' }
const VARIETY = { resource: 'varieties', value: 'var_id', label: 'var_name' }
const TELEMETRY = { resource: 'telemetry', value: 'kt_id', label: 'kt_name' }

const STATUS: FieldDef = { key: '', label: 'Status', kind: 'enum', options: ['1', '0'] }
const status = (key: string): FieldDef => ({ ...STATUS, key })

export const MASTER_DATA: ResourceDef[] = [
  {
    resource: 'plant-types',
    group: 'Komoditas',
    label: 'Jenis',
    idKey: 'ptype_id',
    manualId: true,
    idHint: 'Mis. PT-PADI',
    writeRoles: ['admin', 'agronom'],
    note: 'Pada tahap ini hanya PT-PADI yang aktif di form Budidaya.',
    columns: [
      { key: 'ptype_id', label: 'Kode' },
      { key: 'ptype_name', label: 'Nama' },
      { key: 'ptype_latin', label: 'Nama latin' },
      { key: 'ptype_age_unit', label: 'Satuan umur' },
      { key: 'ptype_spacing', label: 'Jarak tanam' },
      { key: 'ptype_density', label: 'Populasi/ha', align: 'right' },
      { key: 'ptype_sts', label: 'Status' },
    ],
    fields: [
      { key: 'ptype_name', label: 'Nama', kind: 'text', required: true },
      { key: 'ptype_latin', label: 'Nama latin', kind: 'text' },
      { key: 'ptype_category', label: 'Kategori', kind: 'text' },
      { key: 'ptype_age_unit', label: 'Satuan umur fase', kind: 'enum', options: ['DAY', 'MONTH'] },
      { key: 'ptype_spacing', label: 'Jarak tanam', kind: 'text' },
      { key: 'ptype_density', label: 'Populasi standar (per ha)', kind: 'int' },
      { key: 'ptype_lifespan', label: 'Umur ekonomis', kind: 'int' },
      { key: 'ptype_desc', label: 'Keterangan', kind: 'text' },
      status('ptype_sts'),
    ],
  },
  {
    resource: 'phases',
    group: 'Komoditas',
    label: 'Fase',
    idKey: 'phase_id',
    manualId: true,
    idHint: 'Mis. PH-PADI-03',
    writeRoles: ['admin', 'agronom'],
    listParams: { ptype_id: 'PT-PADI' },
    note: 'Rentang umur tidak boleh tumpang tindih dalam satu jenis (batas akhir fase = awal fase berikutnya).',
    columns: [
      { key: 'phase_seq', label: 'Urutan', align: 'right' },
      { key: 'phase_code', label: 'Kode' },
      { key: 'phase_name', label: 'Nama' },
      { key: 'phase_start_age', label: 'Umur awal', align: 'right' },
      { key: 'phase_end_age', label: 'Umur akhir', align: 'right' },
      { key: 'phase_color', label: 'Warna peta' },
      { key: 'phase_sts', label: 'Status' },
    ],
    fields: [
      { key: 'ptype_id', label: 'Jenis', kind: 'ref', ref: PT, required: true, createOnly: true },
      { key: 'phase_name', label: 'Nama', kind: 'text', required: true },
      { key: 'phase_code', label: 'Kode singkat', kind: 'text' },
      { key: 'phase_seq', label: 'Urutan', kind: 'int', required: true },
      { key: 'phase_start_age', label: 'Umur awal (hari)', kind: 'int' },
      { key: 'phase_end_age', label: 'Umur akhir (hari)', kind: 'int', hint: 'Kosong untuk fase terakhir' },
      { key: 'phase_color', label: 'Warna peta', kind: 'text', hint: 'Mis. #9CCC65' },
      { key: 'phase_desc', label: 'Keterangan', kind: 'text' },
      status('phase_sts'),
    ],
  },
  {
    resource: 'varieties',
    group: 'Komoditas',
    label: 'Varietas',
    idKey: 'var_id',
    manualId: true,
    idHint: 'Mis. VAR-PD-IR64',
    writeRoles: ['admin', 'agronom'],
    listParams: { ptype_id: 'PT-PADI' },
    columns: [
      { key: 'var_name', label: 'Varietas' },
      { key: 'var_maturity', label: 'Umur panen (HSS)', align: 'right' },
      { key: 'var_nursery_age', label: 'Umur bibit', align: 'right' },
      { key: 'var_tbase', label: 'Tbase', align: 'right' },
      { key: 'var_topt', label: 'Topt', align: 'right' },
      { key: 'var_tmax', label: 'Tmax', align: 'right' },
      { key: 'var_yield_potential', label: 'Potensi (t/ha)', align: 'right' },
      { key: 'var_yield_avg', label: 'Rata-rata (t/ha)', align: 'right' },
      { key: 'var_sts', label: 'Status' },
    ],
    fields: [
      { key: 'ptype_id', label: 'Jenis', kind: 'ref', ref: PT, required: true, createOnly: true },
      { key: 'var_name', label: 'Nama', kind: 'text', required: true },
      { key: 'var_code', label: 'Kode', kind: 'text' },
      { key: 'var_origin', label: 'Asal', kind: 'text' },
      { key: 'var_release_year', label: 'Tahun rilis', kind: 'int' },
      { key: 'var_maturity', label: 'Umur panen (HSS)', kind: 'int' },
      { key: 'var_nursery_age', label: 'Umur bibit (hari)', kind: 'int' },
      { key: 'var_tbase', label: 'Tbase (°C)', kind: 'number', hint: 'Tbase ≤ Topt ≤ Tmax' },
      { key: 'var_topt', label: 'Topt (°C)', kind: 'number' },
      { key: 'var_tmax', label: 'Tmax (°C)', kind: 'number' },
      { key: 'var_height', label: 'Tinggi (cm)', kind: 'number' },
      { key: 'var_tiller', label: 'Anakan produktif', kind: 'number' },
      { key: 'var_grain_weight', label: 'Bobot 1000 butir (g)', kind: 'number' },
      { key: 'var_yield_potential', label: 'Potensi hasil (t/ha)', kind: 'number' },
      { key: 'var_yield_avg', label: 'Rata-rata hasil (t/ha)', kind: 'number', hint: 'Tidak melebihi potensi' },
      { key: 'unit_id', label: 'Satuan hasil', kind: 'ref', ref: UNIT },
      { key: 'var_resistance', label: 'Ketahanan', kind: 'text' },
      { key: 'var_desc', label: 'Keterangan', kind: 'text' },
      status('var_sts'),
    ],
  },
  {
    resource: 'variety-phases',
    group: 'Komoditas',
    label: 'Fase varietas',
    idKey: 'vp_id',
    manualId: false,
    writeRoles: ['admin', 'agronom'],
    note: 'Hanya agronom yang dapat menetapkan sumber KALIBRASI.',
    columns: [
      { key: 'var_id', label: 'Varietas', lookup: VARIETY },
      { key: 'phase_id', label: 'Fase', lookup: PHASE },
      { key: 'vp_start_age', label: 'Umur awal', align: 'right' },
      { key: 'vp_end_age', label: 'Umur akhir', align: 'right' },
      { key: 'vp_gdd_start', label: 'GDD awal', align: 'right' },
      { key: 'vp_gdd_end', label: 'GDD akhir', align: 'right' },
      { key: 'vp_source', label: 'Sumber' },
    ],
    fields: [
      { key: 'var_id', label: 'Varietas', kind: 'ref', ref: { ...VARIETY, params: { ptype_id: 'PT-PADI' } }, required: true, createOnly: true },
      { key: 'phase_id', label: 'Fase', kind: 'ref', ref: { ...PHASE, params: { ptype_id: 'PT-PADI' } }, required: true, createOnly: true },
      { key: 'vp_start_age', label: 'Umur awal (HST)', kind: 'int' },
      { key: 'vp_end_age', label: 'Umur akhir (HST)', kind: 'int' },
      { key: 'vp_gdd_start', label: 'GDD awal', kind: 'number' },
      { key: 'vp_gdd_end', label: 'GDD akhir', kind: 'number' },
      { key: 'vp_height_ref', label: 'Tinggi acuan (cm)', kind: 'number' },
      { key: 'vp_tiller_ref', label: 'Anakan acuan', kind: 'number' },
      { key: 'vp_bwd_min', label: 'BWD minimum', kind: 'number', hint: '2-5' },
      { key: 'vp_source', label: 'Sumber', kind: 'enum', options: ['ESTIMASI', 'LITERATUR', 'KALIBRASI'] },
      { key: 'vp_note', label: 'Catatan', kind: 'text' },
      status('vp_sts'),
    ],
  },
  {
    resource: 'phase-params',
    group: 'Ambang per Fase',
    label: 'Ambang per fase',
    idKey: 'ppp_id',
    manualId: false,
    writeRoles: ['admin', 'agronom'],
    note: 'Urutan nilai: batas kritis bawah ≤ peringatan bawah ≤ normal ≤ peringatan atas ≤ batas kritis atas.',
    columns: [
      { key: 'phase_id', label: 'Fase', lookup: PHASE },
      { key: 'kt_id', label: 'Telemetri', lookup: TELEMETRY },
      { key: 'ppp_min_norm_value', label: 'Kritis bawah', align: 'right' },
      { key: 'ppp_min_val_warn', label: 'Peringatan bawah', align: 'right' },
      { key: 'ppp_norm_value', label: 'Normal', align: 'right' },
      { key: 'ppp_max_val_warn', label: 'Peringatan atas', align: 'right' },
      { key: 'ppp_max_norm_value', label: 'Kritis atas', align: 'right' },
      { key: 'ppp_sts', label: 'Status' },
    ],
    fields: [
      { key: 'phase_id', label: 'Fase', kind: 'ref', ref: { ...PHASE, params: { ptype_id: 'PT-PADI' } }, required: true, createOnly: true },
      { key: 'kt_id', label: 'Kode telemetri', kind: 'ref', ref: TELEMETRY, required: true, createOnly: true },
      { key: 'unit_id', label: 'Satuan', kind: 'ref', ref: UNIT },
      { key: 'ppp_min_norm_value', label: 'Batas kritis bawah', kind: 'number' },
      { key: 'ppp_min_val_warn', label: 'Batas peringatan bawah', kind: 'number' },
      { key: 'ppp_norm_value', label: 'Nilai normal', kind: 'number' },
      { key: 'ppp_max_val_warn', label: 'Batas peringatan atas', kind: 'number' },
      { key: 'ppp_max_norm_value', label: 'Batas kritis atas', kind: 'number' },
      { key: 'ppp_note', label: 'Catatan', kind: 'text' },
      status('ppp_sts'),
    ],
  },
  {
    resource: 'activity-types',
    group: 'Jenis Kegiatan',
    label: 'Jenis kegiatan',
    idKey: 'actype_id',
    manualId: true,
    idHint: 'Mis. ACT-PD-TANAM',
    writeRoles: ['admin'],
    columns: [
      { key: 'actype_name', label: 'Nama' },
      { key: 'actype_category', label: 'Kategori' },
      { key: 'unit_id', label: 'Satuan', lookup: UNIT },
      { key: 'actype_need_photo', label: 'Wajib foto' },
      { key: 'ptype_id', label: 'Jenis', lookup: PT },
      { key: 'actype_sts', label: 'Status' },
    ],
    fields: [
      { key: 'ptype_id', label: 'Jenis (kosong = umum)', kind: 'ref', ref: PT },
      { key: 'actype_name', label: 'Nama', kind: 'text', required: true },
      { key: 'actype_category', label: 'Kategori', kind: 'text', hint: 'Mis. PEMUPUKAN, PROTEKSI, PANEN' },
      { key: 'unit_id', label: 'Satuan default', kind: 'ref', ref: UNIT },
      { key: 'actype_need_photo', label: 'Wajib foto', kind: 'enum', options: ['1', '0'] },
      { key: 'actype_desc', label: 'Keterangan', kind: 'text' },
      status('actype_sts'),
    ],
  },
  {
    resource: 'materials',
    group: 'Material',
    label: 'Material',
    idKey: 'mat_id',
    manualId: true,
    idHint: 'Mis. MAT-UREA',
    writeRoles: ['admin'],
    columns: [
      { key: 'mat_name', label: 'Nama' },
      { key: 'mat_category', label: 'Kategori' },
      { key: 'mat_n', label: 'N (%)', align: 'right' },
      { key: 'mat_p2o5', label: 'P₂O₅ (%)', align: 'right' },
      { key: 'mat_k2o', label: 'K₂O (%)', align: 'right' },
      { key: 'mat_mgo', label: 'MgO (%)', align: 'right' },
      { key: 'mat_sts', label: 'Status' },
    ],
    fields: [
      { key: 'mat_name', label: 'Nama', kind: 'text', required: true },
      { key: 'mat_category', label: 'Kategori', kind: 'text', hint: 'Mis. PUPUK_ANORGANIK' },
      { key: 'mat_brand', label: 'Merek', kind: 'text' },
      { key: 'mat_active', label: 'Bahan aktif', kind: 'text' },
      { key: 'mat_conc', label: 'Konsentrasi', kind: 'text' },
      { key: 'mat_n', label: 'N (%)', kind: 'number', hint: '0-100' },
      { key: 'mat_p2o5', label: 'P₂O₅ (%)', kind: 'number' },
      { key: 'mat_k2o', label: 'K₂O (%)', kind: 'number' },
      { key: 'mat_mgo', label: 'MgO (%)', kind: 'number' },
      { key: 'mat_cao', label: 'CaO (%)', kind: 'number' },
      { key: 'mat_s', label: 'S (%)', kind: 'number' },
      { key: 'mat_b', label: 'B (%)', kind: 'number' },
      { key: 'mat_c_org', label: 'C-organik (%)', kind: 'number' },
      { key: 'unit_id', label: 'Satuan', kind: 'ref', ref: UNIT },
      { key: 'mat_desc', label: 'Keterangan', kind: 'text' },
      status('mat_sts'),
    ],
  },
  {
    resource: 'telemetry',
    group: 'Telemetri & Satuan',
    label: 'Kode telemetri',
    idKey: 'kt_id',
    manualId: true,
    idMax: 64,
    idHint: 'Mis. KT-ENV-TEMP',
    writeRoles: ['admin'],
    note: 'Kode yang dipakai sensor tidak dapat dihapus.',
    columns: [
      { key: 'kt_id', label: 'Kode' },
      { key: 'kt_name', label: 'Nama' },
      { key: 'kt_min_value', label: 'Batas bawah', align: 'right' },
      { key: 'kt_min_value_warn', label: 'Peringatan bawah', align: 'right' },
      { key: 'kt_norm_value', label: 'Normal', align: 'right' },
      { key: 'kt_max_value_warn', label: 'Peringatan atas', align: 'right' },
      { key: 'kt_max_value', label: 'Batas atas', align: 'right' },
      { key: 'kt_sts', label: 'Status' },
    ],
    fields: [
      { key: 'kt_name', label: 'Nama', kind: 'text', required: true },
      { key: 'kt_min_value', label: 'Batas bawah', kind: 'text', hint: 'Angka' },
      { key: 'kt_min_value_warn', label: 'Peringatan bawah', kind: 'text' },
      { key: 'kt_norm_value', label: 'Nilai normal', kind: 'text' },
      { key: 'kt_max_value_warn', label: 'Peringatan atas', kind: 'text' },
      { key: 'kt_max_value', label: 'Batas atas', kind: 'text' },
      status('kt_sts'),
    ],
  },
  {
    resource: 'units',
    group: 'Telemetri & Satuan',
    label: 'Satuan',
    idKey: 'unit_id',
    manualId: true,
    idHint: 'Mis. UNIT-KG',
    writeRoles: ['admin'],
    columns: [
      { key: 'unit_id', label: 'Kode' },
      { key: 'unit_name', label: 'Nama' },
      { key: 'unit_symbol', label: 'Simbol' },
      { key: 'unit_sts', label: 'Status' },
    ],
    fields: [
      { key: 'unit_name', label: 'Nama', kind: 'text', required: true },
      { key: 'unit_symbol', label: 'Simbol', kind: 'text', hint: 'Maksimal 8 karakter' },
      status('unit_sts'),
    ],
  },
]

export const findResource = (resource: string) => MASTER_DATA.find((r) => r.resource === resource)

export const canEditResource = (user: { user_role: string } | null | undefined, def: ResourceDef): boolean =>
  !!user && def.writeRoles.includes(user.user_role)

/** Status 0/1 dan nilai boolean lain ditampilkan sebagai teks. */
export function cellText(def: ResourceDef, col: ColumnDef, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  if (col.key.endsWith('_sts')) return Number(value) === 1 ? 'Aktif' : 'Nonaktif'
  if (col.key === 'actype_need_photo') return Number(value) === 1 ? 'Ya' : 'Tidak'
  return `${value}${col.suffix ?? ''}`
}

/** Nilai awal form dari baris (angka -> string untuk input). */
export function initialValue(field: FieldDef, row: Record<string, unknown> | null): string {
  const v = row?.[field.key]
  if (v === null || v === undefined) return field.kind === 'enum' && field.key.endsWith('_sts') ? '1' : ''
  return String(v)
}

/** Ubah isian form menjadi body API: '' -> null (hapus), angka sesuai jenis, enum status -> angka. */
export function buildBody(def: ResourceDef, values: Record<string, string>, editing: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of def.fields) {
    if (editing && f.createOnly) continue
    const raw = (values[f.key] ?? '').trim()
    if (raw === '' || raw === 'none') {
      if (editing) body[f.key] = null
      continue
    }
    if (f.kind === 'number' || f.kind === 'int') body[f.key] = Number(raw.replace(',', '.'))
    else if (f.kind === 'enum' && (f.key.endsWith('_sts') || f.key === 'actype_need_photo')) body[f.key] = Number(raw)
    else body[f.key] = raw
  }
  return body
}
