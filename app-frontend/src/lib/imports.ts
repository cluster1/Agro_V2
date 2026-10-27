export type ImportType = 'harvests' | 'observations'

export const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: 'harvests', label: 'Panen', description: 'Berat GKP, kadar air, dan luas dipanen per tanaman' },
  { value: 'observations', label: 'Observasi', description: 'Tinggi, anakan, BWD, gejala, dan hama per tanaman' },
]

export interface ImportRow {
  line: number
  ok: boolean
  errors: string[]
  data?: Record<string, unknown>
  cells?: Record<string, string>
}

export interface ImportReport {
  type: ImportType
  committed: boolean
  total: number
  valid: number
  invalid: number
  saved: number
  ignored_columns: string[]
  rows: ImportRow[]
}

export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const ACCEPT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** CSV berisi hanya baris gagal beserta kolom "galat", siap diperbaiki lalu diunggah ulang. */
export function failedRowsCsv(report: ImportReport, quote: (v: unknown) => string): string {
  const failed = report.rows.filter((r) => !r.ok && r.cells)
  if (!failed.length) return ''
  const columns = [...new Set(failed.flatMap((r) => Object.keys(r.cells!)))]
  const header = [...columns, 'baris', 'galat'].map(quote).join(',')
  const lines = failed.map((r) => [...columns.map((c) => r.cells![c] ?? ''), r.line, r.errors.join('; ')].map(quote).join(','))
  return '\uFEFF' + [header, ...lines].join('\r\n')
}
