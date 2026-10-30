// Pembangun jawaban chatbot dari data nyata. Fungsi murni: komponen yang mengambil data dan memanggilnya.
// Hanya `import type` dari berkas lain agar bisa dites dengan `node --test`.
import type { NitrogenCheckHint, PlantTwin } from '../twin.ts'
import type { FarmDashboard } from '../farm-reports.ts'
import { confidenceWord, growthGrade, leafColorGrade, yieldGrade } from './fuzzy.ts'
import { GLOSSARY } from './glossary.ts'
import { QUICK_SUGGESTIONS, SUGGESTIONS, type IntentId, type MatchResult } from './intents.ts'

export interface AlertItem {
  alm_date: string
  alm_sts: number | null
  alcode_note: string
  dev_name: string
  ds_name: string
  read_value: number
  unit_symbol: string
}

export interface ScheduleItem {
  sched_title: string
  sched_start_date: string
  /** 0 rencana, 1 berjalan, 2 selesai, 3 batal, 4 terlambat */
  sched_sts: number
  plant_id: string
}

export interface Suggestion {
  label: string
  text: string
}

export interface ReplyAction {
  type: 'simulate'
  plantId: string
  plantName: string
}

export interface Reply {
  paragraphs: string[]
  suggestions: Suggestion[]
  action?: ReplyAction
}

export interface AnswerContext {
  /** tanggal hari ini (yyyy-MM-dd), untuk jendela jadwal */
  today: string
  plants: { plant_id: string; name: string | null }[]
  twin: PlantTwin | null
  farm: FarmDashboard | null
  alerts: AlertItem[]
  schedules: ScheduleItem[]
  /** hasil `nStatus` + `N_STATUS` untuk petak ini */
  nitrogenLabel: string | null
  hint: NitrogenCheckHint | null
  /** jumlah hari pada pertanyaan jadwal */
  days: number
  /** hanya menyaring jadwal petak tertentu bila pengguna menyebutnya */
  schedulePlantId: string | null
  canSimulate: boolean
  symptomLabel: (code: string) => string
}

/** Data yang harus dimuat komponen sebelum menjawab maksud ini. */
export function neededData(intent: IntentId): ('twin' | 'farm' | 'alerts' | 'schedules')[] {
  switch (intent) {
    case 'yield':
    case 'nutrient':
    case 'leaf_color':
    case 'phase':
    case 'growth':
    case 'fertilizer':
    case 'sensors':
    case 'weather':
    case 'recompute':
      return ['twin']
    case 'schedule':
      return ['schedules']
    case 'alerts':
      return ['alerts']
    case 'farm':
      return ['farm']
    default:
      return []
  }
}

const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const num = (n: number | null | undefined): string => (n === null || n === undefined ? '-' : nf.format(n))
/** Dua desimal, untuk indeks pertumbuhan (0,97). */
const num2 = (n: number): string => nf2.format(n)
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const day = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`)
const fmtDate = (s: string | null | undefined): string => (s ? dateFmt.format(day(s)) : '-')
const fmtShort = (s: string | null | undefined): string => (s ? shortDateFmt.format(day(s)) : '-')
const daysBetween = (from: string, to: string): number => Math.round((day(to).getTime() - day(from).getTime()) / 86_400_000)

const DISCLAIMER = 'Angka ini berasal dari model dan perlu dicek penyuluh sebelum dipakai.'

/** Pengali prediksi: 1 = tidak mengubah, di bawah 1 menurunkan hasil. */
function factorText(f: number | null | undefined): string {
  if (f === null || f === undefined) return '-'
  if (f >= 0.995) return 'normal'
  return `menurunkan hasil ${nf.format(Math.round((1 - f) * 100))}%`
}

const suggestionOf = (id: IntentId): Suggestion | null => SUGGESTIONS[id]
const suggestionsOf = (ids: IntentId[]): Suggestion[] => ids.map(suggestionOf).filter((s): s is Suggestion => !!s)

function plantName(ctx: AnswerContext): string {
  const t = ctx.twin
  return t ? (t.plant.name ?? t.plant.plant_id) : ''
}

/** Meminta petak bila belum ada yang dipilih. */
function askPlant(intent: IntentId, ctx: AnswerContext): Reply {
  if (ctx.plants.length === 0) return { paragraphs: ['Belum ada petak aktif di akun ini.'], suggestions: [] }
  const base = SUGGESTIONS[intent]?.text ?? ''
  return {
    paragraphs: ['Petak mana yang Anda maksud? Pilih salah satu atau sebutkan namanya.'],
    suggestions: ctx.plants.slice(0, 6).map((p) => {
      const name = p.name ?? p.plant_id
      return { label: name, text: `${base} ${name}`.trim() }
    }),
  }
}

function yieldReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  const y = t.yield
  if (!y || y.value === null) {
    return {
      paragraphs: [`Perkiraan hasil untuk ${name} belum ada. ${ctx.canSimulate ? 'Saya bisa menghitungnya.' : 'Minta admin, admin tenant, atau agronom menjalankan "Hitung perkiraan".'}`],
      suggestions: ctx.canSimulate ? suggestionsOf(['recompute']) : [],
    }
  }
  const out: string[] = []
  const range = y.low !== null && y.high !== null ? ` (rentang ${num(y.low)} sampai ${num(y.high)})` : ''
  const pos = yieldGrade(y.value, y.avg, y.potential)
  out.push(`Perkiraan hasil panen ${name}: ${num(y.value)} ton/ha gabah kering${range}.${pos ? ` Angka ini ${pos}.` : ''}`)

  if (y.method === 'KOMPONEN') {
    out.push('Cara hitung: dari hitungan malai dan gabah, jadi lebih akurat.')
  } else if (y.factors) {
    const f = y.factors
    out.push(`Cara hitung: perkiraan awal dari rata-rata varietas (${num(y.avg)}) dikalikan pengaruh pertumbuhan (${factorText(f.f_growth)}), nitrogen (${factorText(f.f_n)}), dan hama (${factorText(f.f_pest)}).`)
    if (y.avg !== null && f.f_growth >= 0.995 && f.f_n >= 0.995 && f.f_pest >= 0.995) {
      out.push(`Semua pengaruh normal, jadi perkiraan sama dengan rata-rata varietas (${num(y.avg)}).`)
    }
  }
  const conf = confidenceWord(y.confidence)
  if (conf && y.confidence !== null) {
    out.push(`Tingkat kepastian ${Math.round(y.confidence * 100)}% (${conf})${y.method === 'FAKTOR' ? ', karena tanaman belum berbunga; naik setelah ada hitungan malai dan gabah' : ''}.`)
  }
  if (y.harvest_date) out.push(`Perkiraan panen: ${fmtDate(y.harvest_date)}.`)
  return { paragraphs: out, suggestions: suggestionsOf(['nutrient', 'phase']) }
}

function lastBwd(t: PlantTwin): { date: string; bwd: number } | null {
  const o = [...t.observations].reverse().find((x) => x.bwd !== null)
  return o ? { date: o.date, bwd: o.bwd as number } : null
}

function leafLines(ctx: AnswerContext): string[] {
  const t = ctx.twin as PlantTwin
  const min = t.reference.bwd_min
  const last = lastBwd(t)
  const lines: string[] = []
  if (min === null) {
    lines.push('Tahap tumbuh ini tidak punya batas warna daun, jadi nitrogen tidak diukur.')
  } else if (!last) {
    lines.push('Belum ada pengamatan warna daun (BWD).')
  } else {
    const g = leafColorGrade(last.bwd, min)
    lines.push(`Warna daun terakhir (${fmtDate(last.date)}): skala ${num(last.bwd)}, minimal tahap ini ${num(min)}${g ? `: ${g.phrase}` : ''}.`)
  }
  const latest = t.observations[t.observations.length - 1]
  if (latest && latest.symptoms.length > 0) {
    lines.push(`Kondisi daun pada pengamatan terakhir: ${latest.symptoms.map(ctx.symptomLabel).join(', ')}.`)
  }
  return lines
}

function hintLines(ctx: AnswerContext): string[] {
  return ctx.hint && ctx.hint.messages.length > 0 ? [...ctx.hint.messages, 'Status nitrogen di atas belum berubah karena tetap dihitung dari warna daun (BWD).'] : []
}

function defText(v: number | null, unit: string): string {
  if (v === null) return 'belum dihitung'
  return v > 0 ? `kurang ${num(v)} ${unit}` : 'cukup'
}

function nutrientReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  const n = t.nutrients
  const out: string[] = [`Kecukupan nitrogen ${name}: ${ctx.nitrogenLabel?.toLowerCase() ?? 'tidak diukur'}.`, ...leafLines(ctx)]
  out.push(`Nitrogen (N): ${defText(n.n_def, 'kg N/ha')}. Fosfor (P): ${defText(n.p2o5_def, 'kg/ha')}. Kalium (K): ${defText(n.k2o_def, 'kg/ha')}.`)
  if (n.soil_p || n.soil_k) out.push(`Status tanah: fosfor ${(n.soil_p ?? '-').toLowerCase()}, kalium ${(n.soil_k ?? '-').toLowerCase()}.`)
  out.push(...hintLines(ctx))
  out.push(DISCLAIMER)
  return { paragraphs: out, suggestions: suggestionsOf(['fertilizer', 'leaf_color']) }
}

function leafColorReply(ctx: AnswerContext): Reply {
  const out = [`Warna daun ${plantName(ctx)}:`, ...leafLines(ctx), ...hintLines(ctx)]
  if (ctx.nitrogenLabel) out.splice(1, 0, `Status nitrogen resmi: ${ctx.nitrogenLabel.toLowerCase()}.`)
  return { paragraphs: out, suggestions: suggestionsOf(['nutrient', 'glossary']) }
}

function fertilizerReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const r = t.recommendation
  const name = plantName(ctx)
  if (!r) return { paragraphs: [`Belum ada rekomendasi pupuk untuk ${name} saat ini.`], suggestions: suggestionsOf(['nutrient']) }
  return {
    paragraphs: [
      `Rekomendasi pupuk terdekat untuk ${name}${r.start ? ` (${fmtDate(r.start)})` : ''}: ${r.description ?? r.plan_value ?? r.title}.`,
      'Dosis awal dari sistem; mohon dicek penyuluh sebelum dipakai.',
    ],
    suggestions: suggestionsOf(['nutrient', 'schedule']),
  }
}

function phaseReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  const phase = t.now.phase
  const out: string[] = []
  out.push(phase ? `${name} sekarang di tahap ${phase.name}${t.now.age !== null ? ` (umur ${t.now.age} hari)` : ''}.` : `Tahap tumbuh ${name} belum diketahui.`)
  const timeline = t.simulation?.timeline ?? []
  const next = timeline.find((p) => p.start > t.now.date)
  if (next) out.push(`Tahap berikutnya ${next.name} mulai ${fmtDate(next.start)} (perkiraan).`)
  const harvest = t.yield?.harvest_date ?? (timeline.length ? timeline[timeline.length - 1].start : null)
  if (harvest) out.push(`Perkiraan panen: ${fmtDate(harvest)}${harvest > t.now.date ? `, sekitar ${daysBetween(t.now.date, harvest)} hari lagi` : ''}.`)
  if (!t.simulation) out.push('Perkiraan belum dihitung, jadi tahap hanya dari data tanaman.')
  return { paragraphs: out, suggestions: suggestionsOf(['yield', 'growth']) }
}

function growthReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  const g = t.growth
  const out: string[] = []
  const grade = growthGrade(g.index)
  if (g.index === null || !grade) {
    out.push(`Indeks pertumbuhan ${name} belum ada: belum ada pengamatan terverifikasi dalam 14 hari terakhir.`)
  } else {
    out.push(`Pertumbuhan ${name}: ${num2(g.index)} (${grade.phrase}).`)
    if (grade.stunted) out.push('Pertumbuhan di bawah 0,85 (kerdil): periksa tanaman di lapangan.')
  }
  const latest = [...t.observations].reverse().find((o) => o.height !== null || o.tiller !== null)
  if (latest) out.push(`Pengamatan terakhir (${fmtDate(latest.date)}): tinggi ${latest.height ?? '-'} cm, anakan ${latest.tiller ?? '-'}.`)
  else out.push('Belum ada pengamatan tersimpan.')
  return { paragraphs: out, suggestions: suggestionsOf(['nutrient', 'yield']) }
}

function scheduleReply(ctx: AnswerContext): Reply {
  const end = new Date(day(ctx.today).getTime() + ctx.days * 86_400_000).toISOString().slice(0, 10)
  const nameOf = (id: string) => ctx.plants.find((p) => p.plant_id === id)?.name ?? id
  const rows = ctx.schedules
    .filter((s) => (!ctx.schedulePlantId || s.plant_id === ctx.schedulePlantId) && s.sched_sts !== 2 && s.sched_sts !== 3)
    .filter((s) => s.sched_start_date.slice(0, 10) <= end)
    .sort((a, b) => a.sched_start_date.localeCompare(b.sched_start_date))
  const upcoming = rows.filter((s) => s.sched_start_date.slice(0, 10) >= ctx.today)
  const late = rows.filter((s) => s.sched_start_date.slice(0, 10) < ctx.today)
  if (rows.length === 0) return { paragraphs: [`Tidak ada jadwal kegiatan dalam ${ctx.days} hari ke depan.`], suggestions: suggestionsOf(['alerts']) }
  const item = (s: ScheduleItem) => `• ${fmtShort(s.sched_start_date)}: ${s.sched_title} (${nameOf(s.plant_id)})`
  const out: string[] = [`Jadwal ${ctx.days} hari ke depan: ${upcoming.length} kegiatan.`]
  if (upcoming.length) out.push(upcoming.slice(0, 5).map(item).join('\n') + (upcoming.length > 5 ? `\nDan ${upcoming.length - 5} lainnya.` : ''))
  if (late.length) out.push(`Terlambat ${late.length} kegiatan:\n${late.slice(0, 3).map(item).join('\n')}`)
  return { paragraphs: out, suggestions: suggestionsOf(['alerts', 'farm']) }
}

function alertsReply(ctx: AnswerContext): Reply {
  const open = ctx.alerts.filter((a) => (a.alm_sts ?? 0) === 0)
  if (open.length === 0) return { paragraphs: ['Tidak ada alert yang belum ditangani.'], suggestions: suggestionsOf(['sensors', 'schedule']) }
  const line = (a: AlertItem) => `• ${a.alcode_note}: ${a.dev_name}, ${a.ds_name} ${num(a.read_value)} ${a.unit_symbol ?? ''}`.trim() + ` (${fmtShort(a.alm_date)})`
  return {
    paragraphs: [`Ada ${open.length} alert yang belum ditangani.`, open.slice(0, 5).map(line).join('\n') + (open.length > 5 ? `\nDan ${open.length - 5} lainnya.` : ''), 'Buka menu Alert untuk menandainya dilihat atau selesai.'],
    suggestions: suggestionsOf(['sensors']),
  }
}

function sensorsReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  const params = t.sensors
  if (params.length === 0) return { paragraphs: [`Belum ada sensor terhubung ke ${name}.`], suggestions: [] }
  const state = (p: (typeof params)[number]): 'low' | 'high' | 'ok' | 'none' => {
    if (p.value === null) return 'none'
    if (p.warn_min !== null && p.value < p.warn_min) return 'low'
    if (p.warn_max !== null && p.value > p.warn_max) return 'high'
    return 'ok'
  }
  const bad = params.filter((p) => state(p) === 'low' || state(p) === 'high')
  const out = [`${params.length} parameter sensor terhubung ke ${name}; ${bad.length} di luar batas peringatan.`]
  if (bad.length) out.push(bad.slice(0, 5).map((p) => `• ${p.name}: ${num(p.value)} (${state(p) === 'low' ? 'di bawah' : 'di atas'} batas)`).join('\n'))
  const empty = params.filter((p) => p.value === null).length
  if (empty) out.push(`${empty} parameter belum punya data.`)
  return { paragraphs: out, suggestions: suggestionsOf(['alerts', 'weather']) }
}

function weatherReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const w = t.weather
  const out: string[] = []
  if (w.latest) {
    const l = w.latest
    out.push(`Cuaca terakhir (${fmtShort(l.date)}): ${num(l.tmin)} sampai ${num(l.tmax)} °C${l.rain != null ? `, hujan ${num(l.rain)} mm` : ''}${l.rh != null ? `, kelembapan ${num(l.rh)}%` : ''}.`)
  } else {
    out.push('Belum ada data cuaca aktual untuk lokasi ini.')
  }
  if (w.forecast.length) {
    out.push('Prakiraan:\n' + w.forecast.slice(0, 5).map((f) => `• ${fmtShort(f.date)}: ${num(f.tmin)} sampai ${num(f.tmax)} °C${f.rain != null ? `, hujan ${num(f.rain)} mm` : ''}`).join('\n'))
  }
  return { paragraphs: out, suggestions: suggestionsOf(['sensors', 'phase']) }
}

function farmReply(ctx: AnswerContext): Reply {
  const f = ctx.farm as FarmDashboard
  const out: string[] = [`Terpantau ${f.plants} petak seluas ${num(f.area_ha)} ha.`]
  const phases = f.phases.filter((p) => p.count > 0)
  if (phases.length) out.push('Per tahap tumbuh: ' + phases.map((p) => `${p.name} ${p.count} petak (${num(p.area_ha)} ha)`).join(', ') + '.')
  if (f.next_harvest) {
    out.push(`Panen terdekat: ${f.next_harvest.plant_name ?? f.next_harvest.plant_id}, ${fmtDate(f.next_harvest.date)} (${f.next_harvest.source === 'MODEL' ? 'perkiraan model' : 'rencana'}).`)
  }
  out.push(`Jadwal ${f.schedules.window_days} hari: ${f.schedules.total} kegiatan. Alert terbuka: ${f.open_alerts}.`)
  return { paragraphs: out, suggestions: suggestionsOf(['schedule', 'alerts']) }
}

function recomputeReply(ctx: AnswerContext): Reply {
  const t = ctx.twin as PlantTwin
  const name = plantName(ctx)
  if (!ctx.canSimulate) {
    return { paragraphs: ['Peran Anda tidak bisa menjalankan perhitungan perkiraan. Minta admin, admin tenant, atau agronom.'], suggestions: [] }
  }
  return {
    paragraphs: [`Saya bisa menghitung ulang perkiraan untuk ${name}. Ini menjalankan simulasi BASE dan memperbarui hasil, tahap, dan rekomendasi. Lanjutkan?`],
    suggestions: [],
    action: { type: 'simulate', plantId: t.plant.plant_id, plantName: name },
  }
}

function glossaryReply(match: Extract<MatchResult, { kind: 'intent' }>): Reply {
  if (match.term) return { paragraphs: [`${match.term.title}: ${match.term.text}`], suggestions: [] }
  return {
    paragraphs: ['Istilah apa yang ingin dijelaskan?'],
    suggestions: GLOSSARY.slice(0, 6).map((g) => ({ label: g.title.split(' (')[0], text: `Apa itu ${g.terms[0].toUpperCase()}?` })),
  }
}

const HELP = [
  'Saya asisten data petak. Saya menjawab dari data yang ada di aplikasi ini, tanpa mengarang angka. Contoh yang bisa ditanyakan:',
  '• Perkiraan hasil panen dan cara menghitungnya\n• Kecukupan hara, warna daun (BWD), dan rekomendasi pupuk\n• Tahap tumbuh dan perkiraan panen, pertumbuhan tanaman\n• Jadwal kegiatan, alert, sensor, dan cuaca\n• Ringkasan kebun\n• Arti istilah seperti BWD, GDD, GKG\n• Menghitung ulang perkiraan (dengan konfirmasi)',
]

/** Jawaban untuk satu pertanyaan. Data yang dibutuhkan harus sudah dimuat pemanggil (lihat `neededData`). */
export function buildReply(match: MatchResult, ctx: AnswerContext): Reply {
  if (match.kind === 'unknown') {
    return { paragraphs: ['Maaf, saya belum paham pertanyaan itu. Coba salah satu topik berikut, atau ketik "bantuan".'], suggestions: QUICK_SUGGESTIONS }
  }
  if (match.kind === 'ambiguous') {
    return { paragraphs: ['Maksud Anda yang mana?'], suggestions: suggestionsOf(match.options) }
  }
  const intent = match.intent
  switch (intent) {
    case 'greeting':
      return { paragraphs: ['Halo! Saya bisa membantu menjawab data petak Anda.'], suggestions: QUICK_SUGGESTIONS }
    case 'thanks':
      return { paragraphs: ['Sama-sama.'], suggestions: [] }
    case 'help':
      return { paragraphs: HELP, suggestions: QUICK_SUGGESTIONS }
    case 'glossary':
      return glossaryReply(match)
    case 'farm':
      return ctx.farm ? farmReply(ctx) : { paragraphs: ['Data kebun belum tersedia.'], suggestions: [] }
    case 'alerts':
      return alertsReply(ctx)
    case 'schedule':
      return scheduleReply(ctx)
    default:
      break
  }
  if (!ctx.twin) return askPlant(intent, ctx)
  switch (intent) {
    case 'yield':
      return yieldReply(ctx)
    case 'nutrient':
      return nutrientReply(ctx)
    case 'leaf_color':
      return leafColorReply(ctx)
    case 'fertilizer':
      return fertilizerReply(ctx)
    case 'phase':
      return phaseReply(ctx)
    case 'growth':
      return growthReply(ctx)
    case 'sensors':
      return sensorsReply(ctx)
    case 'weather':
      return weatherReply(ctx)
    case 'recompute':
      return recomputeReply(ctx)
    default:
      return { paragraphs: ['Maaf, saya belum paham pertanyaan itu.'], suggestions: QUICK_SUGGESTIONS }
  }
}
