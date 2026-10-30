import { normalize, stem, tokenize, wordScore } from './text.ts'
import { findGlossary, type GlossaryEntry } from './glossary.ts'

export type IntentId =
  | 'yield'
  | 'nutrient'
  | 'leaf_color'
  | 'phase'
  | 'growth'
  | 'fertilizer'
  | 'schedule'
  | 'alerts'
  | 'sensors'
  | 'weather'
  | 'farm'
  | 'recompute'
  | 'glossary'
  | 'help'
  | 'greeting'
  | 'thanks'

type Keyword = [word: string, weight: number]

interface IntentDef {
  id: IntentId
  keywords: Keyword[]
}

/** Skor minimal agar maksud diterima. Satu kata lemah (bobot di bawah ini) saja tidak cukup. */
export const MIN_SCORE = 0.6
const GLOSSARY_TERM_BONUS = 1

/** Kata kunci per maksud. Frasa (lebih dari satu kata) dihitung bila semua katanya ada, dengan bobot lebih besar. */
const INTENTS: IntentDef[] = [
  {
    id: 'yield',
    keywords: [['prediksi', 1], ['perkiraan', 0.8], ['hasil', 1], ['hasil panen', 1.5], ['panen', 0.6], ['produksi', 0.8], ['ton', 0.5], ['rentang', 0.8], ['kepastian', 0.6]],
  },
  {
    id: 'recompute',
    keywords: [['hitung ulang', 2.5], ['hitung perkiraan', 2.5], ['hitung', 1], ['simulasi', 1.5], ['jalankan', 1], ['perbarui', 1], ['update', 1]],
  },
  {
    id: 'nutrient',
    keywords: [['hara', 1.2], ['nitrogen', 1.2], ['urea', 0.8], ['fosfor', 1], ['kalium', 1], ['unsur', 0.6], ['kecukupan', 0.8], ['kekurangan', 1], ['defisit', 1], ['npk', 1]],
  },
  {
    id: 'leaf_color',
    keywords: [['bwd', 1.3], ['warna daun', 2], ['daun', 0.8], ['kuning', 1], ['menguning', 1]],
  },
  {
    id: 'fertilizer',
    keywords: [['pupuk', 1.3], ['rekomendasi', 1], ['rekomendasi pupuk', 2], ['saran pupuk', 2], ['dosis', 1], ['urea', 0.6], ['sp36', 0.8], ['kcl', 0.8]],
  },
  {
    id: 'phase',
    keywords: [['tahap', 1.2], ['tahap tumbuh', 2], ['fase', 1.2], ['umur', 1], ['hst', 1], ['kapan panen', 2.5], ['tanggal panen', 2.5], ['kapan', 0.5]],
  },
  {
    id: 'growth',
    keywords: [['pertumbuhan', 1.2], ['tinggi', 1.2], ['anakan', 1.2], ['kerdil', 1], ['terhambat', 1], ['indeks', 0.8]],
  },
  {
    id: 'schedule',
    keywords: [['jadwal', 1.5], ['kegiatan', 1], ['agenda', 1], ['tugas', 0.8], ['rencana', 0.8], ['minggu', 0.5]],
  },
  {
    id: 'alerts',
    keywords: [['alert', 1.5], ['alarm', 1.5], ['peringatan', 1], ['notifikasi', 0.8], ['masalah', 0.6]],
  },
  {
    id: 'sensors',
    keywords: [['sensor', 1.5], ['kelembapan', 1], ['kelembaban', 1], ['suhu', 0.8], ['perangkat', 0.8], ['device', 0.8]],
  },
  {
    id: 'weather',
    keywords: [['cuaca', 1.5], ['hujan', 1.2], ['prakiraan', 1], ['ramalan', 1], ['suhu', 0.5]],
  },
  {
    id: 'farm',
    keywords: [['kebun', 1.5], ['ringkasan', 1.5], ['dashboard', 1.5], ['luas', 1], ['semua petak', 1.5], ['seluruh', 0.5], ['panen terdekat', 3.5], ['total', 0.5]],
  },
  {
    id: 'glossary',
    keywords: [['apa itu', 2], ['arti', 1.5], ['maksud', 1.5], ['istilah', 1.2], ['singkatan', 1.2], ['kepanjangan', 1.5], ['jelaskan', 1]],
  },
  {
    id: 'help',
    keywords: [['bantuan', 1.5], ['bantu', 1.5], ['bisa apa', 2], ['menu', 1], ['fitur', 1], ['help', 1.5], ['panduan', 1.2]],
  },
  {
    id: 'greeting',
    keywords: [['halo', 1.5], ['hai', 1.5], ['hello', 1.5], ['selamat', 1], ['pagi', 0.8], ['siang', 0.8], ['sore', 0.8], ['malam', 0.8], ['assalamualaikum', 1.5]],
  },
  {
    id: 'thanks',
    keywords: [['terima kasih', 2], ['makasih', 1.5], ['thanks', 1.5], ['oke', 0.7], ['ok', 0.7]],
  },
]

// kata kunci dihitung stemnya sekali, dengan cara yang sama seperti masukan pengguna
const COMPILED = INTENTS.map((intent) => ({
  id: intent.id,
  keywords: intent.keywords.map(([word, weight]) => ({
    stems: normalize(word).split(' ').map(stem),
    weight,
  })),
}))

/** Kata umum yang tidak boleh dicocokkan secara kabur (mis. "sekarang" jadi "kurang"). */
const STOP_STEMS = new Set(
  ['sekarang', 'sudah', 'bagaimana', 'berapa', 'kenapa', 'mengapa', 'apakah', 'tolong', 'mohon', 'dong', 'dengan', 'untuk', 'yang', 'saya', 'kami', 'kita', 'tidak', 'belum', 'saat', 'sedang', 'masih']
    .map(stem),
)

/** Skor satu frasa: rata-rata skor kata, nol bila ada kata yang tidak ditemukan. */
function phraseScore(stems: string[], tokens: string[]): number {
  let total = 0
  for (const s of stems) {
    let best = 0
    for (const t of tokens) best = Math.max(best, t !== s && STOP_STEMS.has(t) ? 0 : wordScore(t, s))
    if (best === 0) return 0
    total += best
  }
  return total / stems.length
}

export function scoreIntents(input: string): { id: IntentId; score: number }[] {
  const tokens = tokenize(input)
  const glossary = findGlossary(input)
  const scores = COMPILED.map(({ id, keywords }) => {
    let score = 0
    for (const k of keywords) score += k.weight * phraseScore(k.stems, tokens)
    return { id, score }
  })
  // istilah di kamus: bonus bila ada kata pemicu ("apa itu", "arti"); tanpa pemicu hanya bila tidak ada maksud data lain
  if (glossary) {
    const g = scores.find((s) => s.id === 'glossary') as { id: IntentId; score: number }
    const others = Math.max(0, ...scores.filter((s) => s.id !== 'glossary').map((s) => s.score))
    if (g.score > 0) g.score += GLOSSARY_TERM_BONUS
    else if (others < MIN_SCORE) g.score = GLOSSARY_TERM_BONUS
  }
  return scores.sort((a, b) => b.score - a.score)
}

export type MatchResult =
  | { kind: 'intent'; intent: IntentId; score: number; term: GlossaryEntry | null }
  | { kind: 'ambiguous'; options: [IntentId, IntentId] }
  | { kind: 'unknown' }

/**
 * Pilih maksud teratas bila skornya cukup dan jelas unggul; dua pilihan bila selisih tipis;
 * "unknown" bila tidak ada yang cukup.
 */
export function matchIntent(input: string): MatchResult {
  if (!normalize(input)) return { kind: 'unknown' }
  const [top, second] = scoreIntents(input)
  if (!top || top.score < MIN_SCORE) return { kind: 'unknown' }
  if (second && second.score >= MIN_SCORE && second.score >= top.score - 0.25 && second.score >= top.score * 0.8) {
    return { kind: 'ambiguous', options: [top.id, second.id] }
  }
  return { kind: 'intent', intent: top.id, score: top.score, term: top.id === 'glossary' ? findGlossary(input) : null }
}

/** Teks tombol saran cepat: label di tombol, pertanyaan yang dikirim bila ditekan. */
export const SUGGESTIONS: Record<IntentId, { label: string; text: string } | null> = {
  yield: { label: 'Perkiraan hasil', text: 'Berapa perkiraan hasil panen?' },
  nutrient: { label: 'Kecukupan hara', text: 'Bagaimana kecukupan hara?' },
  leaf_color: { label: 'Warna daun (BWD)', text: 'Bagaimana warna daun terakhir?' },
  phase: { label: 'Tahap tumbuh', text: 'Sekarang tahap apa dan kapan panen?' },
  growth: { label: 'Pertumbuhan', text: 'Bagaimana pertumbuhan tanaman?' },
  fertilizer: { label: 'Rekomendasi pupuk', text: 'Apa rekomendasi pupuk?' },
  schedule: { label: 'Jadwal 7 hari', text: 'Jadwal 7 hari ke depan?' },
  alerts: { label: 'Alert terbuka', text: 'Alert apa yang belum ditangani?' },
  sensors: { label: 'Sensor', text: 'Bagaimana kondisi sensor?' },
  weather: { label: 'Cuaca', text: 'Bagaimana cuaca?' },
  farm: { label: 'Ringkasan kebun', text: 'Ringkasan kebun' },
  recompute: { label: 'Hitung ulang perkiraan', text: 'Hitung ulang perkiraan' },
  glossary: { label: 'Arti BWD', text: 'Apa itu BWD?' },
  help: null,
  greeting: null,
  thanks: null,
}

/** Saran awal di panel dan bila pertanyaan tidak dipahami. */
export const QUICK_SUGGESTIONS: { label: string; text: string }[] = (
  ['yield', 'nutrient', 'schedule', 'alerts', 'farm', 'glossary'] as IntentId[]
).map((id) => SUGGESTIONS[id] as { label: string; text: string })

/**
 * Entitas: petak yang disebut pengguna. Kata umum ("petak", "sawah") diabaikan; sisanya harus ada di teks.
 * Mengembalikan plant_id, atau null bila tidak ada petak yang jelas disebut.
 */
export function matchPlant(input: string, plants: { plant_id: string; name: string | null }[]): string | null {
  const text = normalize(input)
  const tokens = text.split(' ').filter(Boolean)
  const GENERIC = new Set(['petak', 'blok', 'sawah', 'lahan', 'kebun'])
  let best: { id: string; score: number } | null = null
  for (const p of plants) {
    const nameTokens = normalize(p.name ?? p.plant_id).split(' ').filter((w) => w && !GENERIC.has(w))
    if (!nameTokens.length) continue
    let score = 0
    let ok = true
    for (const w of nameTokens) {
      const s = Math.max(0, ...tokens.map((t) => wordScore(t, w)))
      if (s === 0) {
        ok = false
        break
      }
      score += s
    }
    if (ok && (!best || score > best.score)) best = { id: p.plant_id, score }
  }
  return best?.id ?? null
}

/** Jumlah hari dari teks ("7 hari", "minggu ini"); bawaan 7, dibatasi 1 sampai 30. */
export function extractDays(input: string): number {
  const text = normalize(input)
  const m = text.match(/(\d{1,3}) hari/)
  if (m) return Math.min(30, Math.max(1, Number(m[1])))
  if (/\bbulan\b/.test(text)) return 30
  if (/\bbesok\b/.test(text)) return 1
  return 7
}
