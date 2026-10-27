import { DATE_RE } from '../plant/plant-rules';

export type ImportType = 'harvests' | 'observations';
export const IMPORT_TYPES: readonly ImportType[] = ['harvests', 'observations'];

interface ColumnDef {
  key: string;
  kind: 'plant' | 'date' | 'datetime' | 'number' | 'int' | 'text' | 'symptoms';
  required?: boolean;
  example: string;
  note: string;
}

export const COLUMNS: Record<ImportType, ColumnDef[]> = {
  harvests: [
    { key: 'plant', kind: 'plant', required: true, example: 'Padi Petak A MT2 2026', note: 'ID atau nama tanaman' },
    { key: 'hv_date', kind: 'date', required: true, example: '2026-12-23', note: 'YYYY-MM-DD atau DD/MM/YYYY' },
    { key: 'hv_weight', kind: 'number', required: true, example: '6000', note: 'Berat GKP (kg)' },
    { key: 'hv_moisture', kind: 'number', required: true, example: '25', note: 'Kadar air (%), 5-40' },
    { key: 'hv_area', kind: 'number', example: '1', note: 'Luas dipanen (ha); kosong = luas tanaman' },
    { key: 'hv_loss_pct', kind: 'number', example: '1.5', note: 'Susut panen (%)' },
    { key: 'hv_price', kind: 'number', example: '6500', note: 'Harga (Rp/kg)' },
    { key: 'hv_desc', kind: 'text', example: 'Panen petak A', note: 'Catatan' },
  ],
  observations: [
    { key: 'plant', kind: 'plant', required: true, example: 'Padi Petak A MT2 2026', note: 'ID atau nama tanaman' },
    { key: 'obs_date', kind: 'datetime', required: true, example: '2026-09-29 08:00', note: 'YYYY-MM-DD [HH:mm]; tanpa jam = 08:00' },
    { key: 'obs_height', kind: 'number', example: '32', note: 'Tinggi (cm), 5-160' },
    { key: 'obs_tiller', kind: 'number', example: '8', note: 'Anakan, 1-60' },
    { key: 'obs_bwd', kind: 'number', example: '3.5', note: 'BWD 2-5 kelipatan 0,5; HST 14-62' },
    { key: 'obs_panicle', kind: 'number', example: '', note: 'Malai per rumpun; mulai berbunga' },
    { key: 'obs_grain', kind: 'number', example: '', note: 'Gabah per malai; masak susu s.d. penuh' },
    { key: 'obs_filled_pct', kind: 'number', example: '', note: '% gabah isi, 0-100' },
    { key: 'obs_phase_pct', kind: 'number', example: '50', note: '% populasi mencapai fase' },
    { key: 'obs_pest_name', kind: 'text', example: '', note: 'Nama hama/penyakit' },
    { key: 'obs_pest_pct', kind: 'number', example: '', note: 'Intensitas hama (%)' },
    { key: 'obs_symptom', kind: 'symptoms', example: '', note: 'Kode dipisah koma: N_KUNING, P_GELAP, K_TEPI, KERDIL, ZN_BERCAK, S_PUCAT' },
    { key: 'obs_sample_n', kind: 'int', example: '20', note: 'Jumlah rumpun sampel (default 20)' },
    { key: 'obs_desc', kind: 'text', example: '', note: 'Catatan' },
  ],
};

export const headerKeys = (type: ImportType) => COLUMNS[type].map((c) => c.key);

const isRealDay = (day: string): boolean => {
  const t = Date.parse(`${day}T00:00:00Z`);
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === day;
};

/** DD/MM/YYYY -> YYYY-MM-DD; ISO passes through. Impossible dates (31 Feb) give null. */
export function normalizeDay(value: string): string | null {
  const v = value.trim();
  let day: string | null = null;
  if (DATE_RE.test(v)) day = v;
  else {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
    if (m) day = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return day && isRealDay(day) ? day : null;
}

/** 'YYYY-MM-DD', 'DD/MM/YYYY', optionally followed by ' HH:mm[:ss]' or 'THH:mm' -> 'YYYY-MM-DDTHH:mm'. */
export function normalizeDateTime(value: string, defaultTime = '08:00'): string | null {
  const m = /^(\S+?)(?:[T ]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(value.trim());
  if (!m) return null;
  const day = normalizeDay(m[1]);
  if (!day) return null;
  const time = m[2] !== undefined ? `${m[2].padStart(2, '0')}:${m[3]}` : defaultTime;
  return `${day}T${time}`;
}

/** '5,5' and '5.5' -> 5.5; anything else NaN. Thousands separators are not accepted. */
export function toNumber(value: string): number {
  const v = value.trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(v)) return NaN;
  return Number(v.replace(',', '.'));
}

export function toSymptoms(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}
