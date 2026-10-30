import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildReply, neededData, type AnswerContext } from './answers.ts'
import { matchIntent, type IntentId } from './intents.ts'
import type { PlantTwin } from '../twin.ts'
import type { FarmDashboard } from '../farm-reports.ts'

function makeTwin(over: Record<string, unknown> = {}): PlantTwin {
  const base = {
    plant: { plant_id: 'P1', name: 'Petak A' },
    now: { date: '2026-10-30', age: 39, phase: { phase_id: 'PH5', name: 'Primordia', seq: 5, code: null, color: null } },
    reference: { bwd_min: 3.5, height: [], tiller: [] },
    observations: [
      { obs_id: 'O1', date: '2026-10-20', bwd: 3.2, height: 60, tiller: 12, symptoms: ['N_KUNING'], status: 2 },
    ],
    simulation: {
      timeline: [
        { name: 'Primordia', start: '2026-10-10' },
        { name: 'Bunting', start: '2026-11-15' },
        { name: 'Masak Penuh', start: '2026-12-30' },
      ],
    },
    growth: { index: 0.97, stunted: false, needs_observation: false },
    nutrients: { n_def: 23, p2o5_def: 12, k2o_def: 0, bwd: 3.2, symptoms: [], soil_p: 'SEDANG', soil_k: 'RENDAH' },
    yield: {
      value: 6.3,
      low: 5.4,
      high: 7.2,
      confidence: 0.5,
      method: 'FAKTOR',
      factors: { f_growth: 1, f_n: 1, f_pest: 1 },
      harvest_date: '2026-12-30',
      avg: 6.3,
      potential: 8.4,
    },
    recommendation: { sched_id: 'S1', title: 'Pupuk susulan', start: '2026-11-02', description: 'Urea 50 kg/ha', plan_value: 'Urea 50' },
    sensors: [
      { name: 'Kelembapan tanah', value: 20, warn_min: 30, warn_max: 90 },
      { name: 'Suhu tanah', value: 28, warn_min: 15, warn_max: 35 },
      { name: 'pH', value: null, warn_min: null, warn_max: null },
    ],
    weather: {
      latest: { date: '2026-10-29', tmin: 23, tmax: 32, rain: 4.5, rh: 80 },
      forecast: [{ date: '2026-10-31', tmin: 24, tmax: 33, rain: 0 }],
    },
    media: [],
  }
  return { ...base, ...over } as unknown as PlantTwin
}

function makeCtx(over: Partial<AnswerContext> = {}): AnswerContext {
  return {
    today: '2026-10-30',
    plants: [
      { plant_id: 'P1', name: 'Petak A' },
      { plant_id: 'P2', name: 'Petak B' },
    ],
    twin: makeTwin(),
    farm: null,
    alerts: [],
    schedules: [],
    nitrogenLabel: 'Mulai kurang',
    hint: null,
    days: 7,
    schedulePlantId: null,
    canSimulate: true,
    symptomLabel: (c) => (c === 'N_KUNING' ? 'Daun menguning (kurang N)' : c),
    ...over,
  }
}

const ask = (text: string, ctx: AnswerContext = makeCtx()) => buildReply(matchIntent(text), ctx)
const textOf = (r: { paragraphs: string[] }) => r.paragraphs.join('\n')

describe('perkiraan hasil', () => {
  it('menjelaskan angka, rentang, cara hitung, dan kepastian', () => {
    const t = textOf(ask('Kenapa perkiraan hasil 6,3?'))
    assert.match(t, /6,3 ton\/ha gabah kering/)
    assert.match(t, /rentang 5,4 sampai 7,2/)
    assert.match(t, /perkiraan awal dari rata-rata varietas/)
    assert.match(t, /Semua pengaruh normal, jadi perkiraan sama dengan rata-rata varietas \(6,3\)/)
    assert.match(t, /Tingkat kepastian 50% \(rendah\)/)
    assert.match(t, /belum berbunga/)
    assert.match(t, /Perkiraan panen: 30 Des 2026/)
  })

  it('faktor di bawah 1 disebut menurunkan hasil', () => {
    const twin = makeTwin({ yield: { ...makeTwin().yield, factors: { f_growth: 0.97, f_n: 0.95, f_pest: 1 }, value: 5.7, avg: 6.3 } })
    const t = textOf(ask('berapa hasil panen', makeCtx({ twin })))
    assert.match(t, /nitrogen \(menurunkan hasil 5%\)/)
    assert.match(t, /pertumbuhan \(menurunkan hasil 3%\)/)
    assert.doesNotMatch(t, /Semua pengaruh normal/)
  })

  it('metode komponen menyebut hitungan malai dan gabah', () => {
    const twin = makeTwin({ yield: { ...makeTwin().yield, method: 'KOMPONEN', confidence: 0.7, factors: null } })
    const t = textOf(ask('hasil panen', makeCtx({ twin })))
    assert.match(t, /hitungan malai dan gabah/)
    assert.match(t, /70% \(sedang\)/)
  })

  it('belum ada perkiraan: menawarkan hitung ulang bila boleh', () => {
    const twin = makeTwin({ yield: null })
    const r = ask('hasil panen', makeCtx({ twin }))
    assert.match(textOf(r), /belum ada/)
    assert.equal(r.suggestions[0].label, 'Hitung ulang perkiraan')
    const denied = ask('hasil panen', makeCtx({ twin, canSimulate: false }))
    assert.deepEqual(denied.suggestions, [])
  })
})

describe('hara dan warna daun', () => {
  it('menyebut status resmi lebih dulu, lalu nuansa fuzzy yang selaras', () => {
    const t = textOf(ask('Bagaimana kecukupan hara?'))
    assert.match(t, /Kecukupan nitrogen Petak A: mulai kurang/)
    assert.match(t, /skala 3,2, minimal tahap ini 3,5: sedikit di bawah batas/)
    assert.match(t, /Nitrogen \(N\): kurang 23 kg N\/ha/)
    assert.match(t, /Fosfor \(P\): kurang 12 kg\/ha/)
    assert.match(t, /Kalium \(K\): cukup/)
    assert.match(t, /dicek penyuluh/)
    assert.match(t, /Daun menguning \(kurang N\)/)
  })

  it('tanpa BWD', () => {
    const twin = makeTwin({ observations: [], nutrients: { ...makeTwin().nutrients, n_def: null, bwd: null } })
    const t = textOf(ask('hara', makeCtx({ twin, nitrogenLabel: 'Tidak diukur' })))
    assert.match(t, /Belum ada pengamatan warna daun/)
    assert.match(t, /Nitrogen \(N\): belum dihitung/)
  })

  it('tahap tanpa batas BWD', () => {
    const twin = makeTwin({ reference: { bwd_min: null, height: [], tiller: [] } })
    assert.match(textOf(ask('hara', makeCtx({ twin }))), /tidak punya batas warna daun/)
  })

  it('peringatan cek warna daun ikut ditampilkan tanpa mengubah status', () => {
    const hint = { messages: ['Mohon cek warna daun (BWD) di lapangan.'], shortMessages: ['x'], source: 's' }
    const t = textOf(ask('hara', makeCtx({ hint })))
    assert.match(t, /Mohon cek warna daun/)
    assert.match(t, /belum berubah karena tetap dihitung dari warna daun/)
    assert.match(t, /mulai kurang/)
  })

  it('pertanyaan warna daun', () => {
    const t = textOf(ask('warna daun terakhir', makeCtx()))
    assert.match(t, /Status nitrogen resmi: mulai kurang/)
    assert.match(t, /skala 3,2/)
  })
})

describe('rekomendasi pupuk', () => {
  it('dengan dan tanpa rekomendasi', () => {
    assert.match(textOf(ask('rekomendasi pupuk')), /Urea 50 kg\/ha/)
    assert.match(textOf(ask('rekomendasi pupuk', makeCtx({ twin: makeTwin({ recommendation: null }) }))), /Belum ada rekomendasi pupuk/)
  })
})

describe('tahap, pertumbuhan, sensor, cuaca', () => {
  it('tahap dan perkiraan panen', () => {
    const t = textOf(ask('sekarang tahap apa dan kapan panen'))
    assert.match(t, /tahap Primordia \(umur 39 hari\)/)
    assert.match(t, /Tahap berikutnya Bunting mulai 15 Nov 2026/)
    assert.match(t, /sekitar 61 hari lagi/)
  })

  it('pertumbuhan baik dan terhambat', () => {
    assert.match(textOf(ask('pertumbuhan tanaman')), /Pertumbuhan Petak A: 0,97 \(baik/)
    const twin = makeTwin({ growth: { index: 0.8, stunted: true, needs_observation: false } })
    const t = textOf(ask('pertumbuhan tanaman', makeCtx({ twin })))
    assert.match(t, /terhambat \(kerdil\)/)
    assert.match(t, /periksa tanaman di lapangan/)
  })

  it('pertumbuhan tanpa indeks', () => {
    const twin = makeTwin({ growth: { index: null, stunted: false, needs_observation: true } })
    assert.match(textOf(ask('pertumbuhan', makeCtx({ twin }))), /belum ada pengamatan terverifikasi dalam 14 hari/)
  })

  it('sensor di luar batas', () => {
    const t = textOf(ask('kondisi sensor'))
    assert.match(t, /3 parameter sensor terhubung ke Petak A; 1 di luar batas/)
    assert.match(t, /Kelembapan tanah: 20 \(di bawah batas\)/)
    assert.match(t, /1 parameter belum punya data/)
  })

  it('cuaca', () => {
    const t = textOf(ask('bagaimana cuaca'))
    assert.match(t, /23 sampai 32 °C, hujan 4,5 mm, kelembapan 80%/)
    assert.match(t, /Prakiraan/)
  })
})

describe('jadwal, alert, kebun', () => {
  const schedules = [
    { sched_title: 'Pupuk susulan I', sched_start_date: '2026-11-02 06:00:00', sched_sts: 0, plant_id: 'P1' },
    { sched_title: 'Amati BWD', sched_start_date: '2026-11-05 06:00:00', sched_sts: 0, plant_id: 'P2' },
    { sched_title: 'Sudah selesai', sched_start_date: '2026-11-03 06:00:00', sched_sts: 2, plant_id: 'P1' },
    { sched_title: 'Jauh', sched_start_date: '2026-12-25 06:00:00', sched_sts: 0, plant_id: 'P1' },
    { sched_title: 'Terlambat', sched_start_date: '2026-10-25 06:00:00', sched_sts: 4, plant_id: 'P1' },
  ]

  it('jadwal dalam jendela hari, tanpa yang selesai dan yang di luar jendela', () => {
    const t = textOf(ask('jadwal 7 hari ke depan', makeCtx({ twin: null, schedules })))
    assert.match(t, /2 kegiatan/)
    assert.match(t, /Pupuk susulan I \(Petak A\)/)
    assert.match(t, /Amati BWD \(Petak B\)/)
    assert.doesNotMatch(t, /Sudah selesai|Jauh/)
    assert.match(t, /Terlambat 1 kegiatan/)
  })

  it('jadwal untuk satu petak', () => {
    const t = textOf(ask('jadwal', makeCtx({ twin: null, schedules, schedulePlantId: 'P1' })))
    assert.match(t, /1 kegiatan/)
    assert.doesNotMatch(t, /Amati BWD/)
  })

  it('jadwal kosong', () => {
    assert.match(textOf(ask('jadwal', makeCtx({ twin: null }))), /Tidak ada jadwal/)
  })

  it('alert terbuka dan kosong', () => {
    const alerts = [
      { alm_date: '2026-10-29 10:00:00', alm_sts: 0, alcode_note: 'Nilai terlalu rendah', dev_name: 'Station A', ds_name: 'Kelembapan', read_value: 20, unit_symbol: '%' },
      { alm_date: '2026-10-28 10:00:00', alm_sts: 2, alcode_note: 'Selesai', dev_name: 'X', ds_name: 'Y', read_value: 1, unit_symbol: '' },
    ]
    const t = textOf(ask('alert apa yang belum ditangani', makeCtx({ twin: null, alerts })))
    assert.match(t, /1 alert yang belum ditangani/)
    assert.match(t, /Station A, Kelembapan 20 %/)
    assert.match(textOf(ask('alert', makeCtx({ twin: null }))), /Tidak ada alert/)
  })

  it('ringkasan kebun', () => {
    const farm: FarmDashboard = {
      plants: 2,
      area_ha: 3.5,
      phases: [{ phase_id: 'PH5', name: 'Primordia', color: null, seq: 5, count: 2, area_ha: 3.5 }],
      health: [],
      next_harvest: { date: '2026-12-22', plant_id: 'P1', plant_name: 'Petak A', source: 'MODEL' },
      schedules: { window_days: 7, total: 3, items: [] },
      open_alerts: 1,
    }
    const t = textOf(ask('ringkasan kebun', makeCtx({ twin: null, farm })))
    assert.match(t, /Terpantau 2 petak seluas 3,5 ha/)
    assert.match(t, /Primordia 2 petak/)
    assert.match(t, /Panen terdekat: Petak A, 22 Des 2026 \(perkiraan model\)/)
    assert.match(t, /Alert terbuka: 1/)
  })
})

describe('hitung ulang perkiraan', () => {
  it('meminta konfirmasi bila diizinkan', () => {
    const r = ask('hitung ulang perkiraan')
    assert.deepEqual(r.action, { type: 'simulate', plantId: 'P1', plantName: 'Petak A' })
    assert.match(textOf(r), /Lanjutkan\?/)
  })

  it('tanpa izin tidak ada aksi', () => {
    const r = ask('hitung ulang perkiraan', makeCtx({ canSimulate: false }))
    assert.equal(r.action, undefined)
    assert.match(textOf(r), /tidak bisa menjalankan/)
  })

  it('tanpa petak terpilih meminta petak, tanpa aksi', () => {
    const r = ask('hitung ulang perkiraan', makeCtx({ twin: null }))
    assert.equal(r.action, undefined)
    assert.match(textOf(r), /Petak mana/)
  })
})

describe('tanpa petak terpilih', () => {
  it('meminta petak dengan tombol per petak', () => {
    const r = ask('hasil panen', makeCtx({ twin: null }))
    assert.match(textOf(r), /Petak mana/)
    assert.deepEqual(r.suggestions.map((s) => s.label), ['Petak A', 'Petak B'])
    assert.ok(r.suggestions[0].text.endsWith('Petak A'))
  })

  it('tanpa petak sama sekali', () => {
    assert.match(textOf(ask('hasil panen', makeCtx({ twin: null, plants: [] }))), /Belum ada petak aktif/)
  })
})

describe('percakapan umum', () => {
  it('istilah kamus', () => {
    assert.match(textOf(ask('apa itu BWD')), /Bagan Warna Daun/)
  })

  it('istilah tidak disebut: menawarkan daftar', () => {
    const r = buildReply({ kind: 'intent', intent: 'glossary', score: 1, term: null }, makeCtx())
    assert.match(textOf(r), /Istilah apa/)
    assert.ok(r.suggestions.length > 0)
  })

  it('salam, terima kasih, bantuan', () => {
    assert.match(textOf(ask('halo')), /Halo/)
    assert.equal(textOf(ask('terima kasih')), 'Sama-sama.')
    assert.match(textOf(ask('bantuan')), /Agro Asisten/)
  })

  it('tidak dikenal memberi saran, ambigu memberi dua pilihan', () => {
    const unknown = ask('cara memasak nasi')
    assert.match(textOf(unknown), /belum paham/)
    assert.ok(unknown.suggestions.length > 0)
    const amb = ask('hara pupuk')
    assert.equal(amb.suggestions.length, 2)
  })
})

describe('neededData', () => {
  it('petak, kebun, alert, jadwal, dan tanpa data', () => {
    const cases: [IntentId, string[]][] = [
      ['yield', ['twin']],
      ['recompute', ['twin']],
      ['schedule', ['schedules']],
      ['alerts', ['alerts']],
      ['farm', ['farm']],
      ['glossary', []],
      ['help', []],
    ]
    for (const [intent, expected] of cases) assert.deepEqual(neededData(intent), expected)
  })
})
