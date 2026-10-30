import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractDays, matchIntent, matchPlant, scoreIntents, QUICK_SUGGESTIONS, SUGGESTIONS, type IntentId } from './intents.ts'
import { findGlossary } from './glossary.ts'

const intentOf = (text: string): string => {
  const r = matchIntent(text)
  return r.kind === 'intent' ? r.intent : r.kind === 'ambiguous' ? `ambiguous:${r.options.join('|')}` : 'unknown'
}

describe('matchIntent: pertanyaan umum', () => {
  const cases: [string, IntentId][] = [
    ['Kenapa perkiraan hasil 6,3?', 'yield'],
    ['berapa hasil panen petak ini', 'yield'],
    ['prediksi produksi padi', 'yield'],
    ['Bagaimana kecukupan hara?', 'nutrient'],
    ['nitrogen petak A kurang tidak?', 'nutrient'],
    ['warna daun terakhir berapa', 'leaf_color'],
    ['daun menguning', 'leaf_color'],
    ['apa rekomendasi pupuk', 'fertilizer'],
    ['dosis pupuk bulan ini', 'fertilizer'],
    ['sekarang tahap apa', 'phase'],
    ['kapan panen', 'phase'],
    ['umur tanaman berapa hari', 'phase'],
    ['bagaimana pertumbuhan tanaman', 'growth'],
    ['anakan sudah cukup?', 'growth'],
    ['jadwal 7 hari ke depan', 'schedule'],
    ['kegiatan minggu ini apa saja', 'schedule'],
    ['alert apa yang belum ditangani', 'alerts'],
    ['ada alarm?', 'alerts'],
    ['kondisi sensor', 'sensors'],
    ['bagaimana cuaca besok', 'weather'],
    ['akan hujan?', 'weather'],
    ['ringkasan kebun', 'farm'],
    ['panen terdekat kapan', 'farm'],
    ['hitung ulang perkiraan', 'recompute'],
    ['jalankan simulasi', 'recompute'],
    ['halo', 'greeting'],
    ['selamat pagi', 'greeting'],
    ['terima kasih', 'thanks'],
    ['bisa apa saja', 'help'],
    ['bantuan', 'help'],
  ]
  for (const [text, intent] of cases) {
    it(`"${text}" -> ${intent}`, () => assert.equal(intentOf(text), intent))
  }
})

describe('matchIntent: salah ketik dan imbuhan', () => {
  it('toleran salah ketik', () => {
    assert.equal(intentOf('prediski hasl panen'), 'yield')
    assert.equal(intentOf('nitrogn petak'), 'nutrient')
    assert.equal(intentOf('jadwl kegiatan'), 'schedule')
    assert.equal(intentOf('berapa perkirann hasil'), 'yield')
  })

  it('imbuhan berbeda tetap dikenali', () => {
    assert.equal(intentOf('diperkirakan hasilnya berapa'), 'yield')
    assert.equal(intentOf('peringatan apa saja'), 'alerts')
  })

  it('huruf besar dan tanda baca diabaikan', () => {
    assert.equal(intentOf('  HASIL PANEN??? '), 'yield')
  })
})

describe('matchIntent: kamus istilah', () => {
  it('"apa itu BWD" menjelaskan istilah, bukan data warna daun', () => {
    const r = matchIntent('Apa itu BWD?')
    assert.equal(r.kind, 'intent')
    if (r.kind === 'intent') {
      assert.equal(r.intent, 'glossary')
      assert.equal(r.term?.id, 'bwd')
    }
  })

  it('istilah tanpa kata tanya tetap dijelaskan bila tidak ada maksud data', () => {
    const r = matchIntent('gkg')
    assert.equal(r.kind, 'intent')
    if (r.kind === 'intent') assert.equal(r.term?.id, 'gkg')
  })

  it('"bwd" saja mengacu ke data warna daun', () => {
    assert.equal(intentOf('bwd'), 'leaf_color')
  })

  it('arti singkatan lain', () => {
    assert.equal(intentOf('arti GDD'), 'glossary')
    assert.equal(intentOf('apa itu jajar legowo'), 'glossary')
  })
})

describe('matchIntent: ambigu dan tidak dikenal', () => {
  it('dua maksud setara menghasilkan dua pilihan', () => {
    const r = matchIntent('hara pupuk')
    assert.equal(r.kind, 'ambiguous')
    if (r.kind === 'ambiguous') assert.deepEqual([...r.options].sort(), ['fertilizer', 'nutrient'])
  })

  it('di luar topik tidak dikenal', () => {
    assert.equal(intentOf('bagaimana cara memasak nasi goreng'), 'unknown')
    assert.equal(intentOf('siapa presiden indonesia'), 'unknown')
  })

  it('kosong tidak dikenal', () => {
    assert.equal(intentOf('   '), 'unknown')
    assert.equal(intentOf('???'), 'unknown')
  })

  it('satu kata lemah saja tidak cukup', () => {
    assert.equal(intentOf('kapan'), 'unknown')
    assert.equal(intentOf('minggu'), 'unknown')
  })

  it('kata umum tidak dicocokkan kabur ke kata kunci', () => {
    assert.equal(intentOf('sekarang'), 'unknown')
  })
})

describe('scoreIntents', () => {
  it('terurut menurun', () => {
    const s = scoreIntents('hasil panen')
    for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].score >= s[i].score)
  })
})

describe('saran cepat', () => {
  it('semua saran cepat punya label dan teks, dan teksnya dikenali sebagai maksud yang sama', () => {
    assert.equal(QUICK_SUGGESTIONS.length, 6)
    for (const [id, s] of Object.entries(SUGGESTIONS)) {
      if (!s) continue
      const r = matchIntent(s.text)
      assert.equal(r.kind, 'intent', `${id}: "${s.text}" -> ${r.kind}`)
      if (r.kind === 'intent') assert.equal(r.intent, id)
    }
  })
})

describe('findGlossary', () => {
  it('mengenali frasa dan kata tunggal', () => {
    assert.equal(findGlossary('apa itu jajar legowo')?.id, 'legowo')
    assert.equal(findGlossary('gkg')?.id, 'gkg')
    assert.equal(findGlossary('ubinan')?.id, 'ubinan')
    assert.equal(findGlossary('ubinn')?.id, 'ubinan')
  })

  it('kata biasa bukan istilah', () => {
    assert.equal(findGlossary('halo apa kabar'), null)
  })
})

describe('matchPlant', () => {
  const plants = [
    { plant_id: 'P1', name: 'Petak A' },
    { plant_id: 'P2', name: 'Petak Sawah Utara' },
    { plant_id: 'P3', name: null },
  ]

  it('mencocokkan nama tanpa kata umum', () => {
    assert.equal(matchPlant('hara petak a', plants), 'P1')
    assert.equal(matchPlant('hasil sawah utara', plants), 'P2')
  })

  it('toleran salah ketik pada nama panjang', () => {
    assert.equal(matchPlant('hasil sawh utra', plants), 'P2')
    assert.equal(matchPlant('hasil utaraa', plants), 'P2')
    assert.equal(matchPlant('hasil ut', plants), null)
  })

  it('tanpa nama petak mengembalikan null', () => {
    assert.equal(matchPlant('berapa hasil panen', plants), null)
  })
})

describe('extractDays', () => {
  it('membaca jumlah hari', () => {
    assert.equal(extractDays('jadwal 14 hari ke depan'), 14)
    assert.equal(extractDays('jadwal 500 hari'), 30)
    assert.equal(extractDays('jadwal bulan ini'), 30)
    assert.equal(extractDays('jadwal besok'), 1)
    assert.equal(extractDays('jadwal'), 7)
  })
})
