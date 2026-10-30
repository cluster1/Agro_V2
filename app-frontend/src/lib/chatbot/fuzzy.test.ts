import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { confidenceWord, grade, growthGrade, leafColorGrade, membership, yieldGrade } from './fuzzy.ts'

describe('membership', () => {
  it('trapesium: naik, datar, turun', () => {
    const mf: [number, number, number, number] = [0, 1, 2, 4]
    assert.equal(membership(-1, mf), 0)
    assert.equal(membership(0.5, mf), 0.5)
    assert.equal(membership(1.5, mf), 1)
    assert.equal(membership(3, mf), 0.5)
    assert.equal(membership(5, mf), 0)
  })

  it('tepi vertikal tidak membagi nol', () => {
    assert.equal(membership(0, [0, 0, 1, 2]), 1)
    assert.equal(membership(2, [0, 1, 2, 2]), 1)
  })
})

describe('grade', () => {
  it('memberi himpunan kedua hanya bila derajatnya 0,3 atau lebih', () => {
    const sets = [
      { label: 'rendah', mf: [0, 0, 1, 3] as [number, number, number, number] },
      { label: 'tinggi', mf: [1, 3, 9, 9] as [number, number, number, number] },
    ]
    assert.equal(grade(0.5, sets).label, 'rendah')
    assert.equal(grade(0.5, sets).second, null)
    const mid = grade(2, sets)
    assert.ok(mid.second)
  })
})

describe('leafColorGrade', () => {
  it('tanpa BWD atau tanpa batas mengembalikan null', () => {
    assert.equal(leafColorGrade(null, 3.5), null)
    assert.equal(leafColorGrade(3, null), null)
  })

  it('BWD 3,2 dengan batas 3,5: sedikit di bawah batas, tidak pernah "cukup"', () => {
    const g = leafColorGrade(3.2, 3.5)
    assert.ok(g)
    assert.equal(g.phrase, 'sedikit di bawah batas')
    assert.ok(!g.phrase.includes('cukup'))
  })

  it('BWD 3 dengan batas 3,5 (mulai kurang resmi): agak kurang, mendekati batas', () => {
    assert.equal(leafColorGrade(3, 3.5)?.phrase, 'agak kurang, mendekati batas')
  })

  it('BWD 2,5 dengan batas 3,5: di bawah batas', () => {
    assert.equal(leafColorGrade(2.5, 3.5)?.phrase, 'di bawah batas')
  })

  it('BWD sama dengan batas: cukup, tepat di batas', () => {
    assert.equal(leafColorGrade(3.5, 3.5)?.phrase, 'cukup, tepat di batas')
  })

  it('BWD di atas batas: cukup, tidak pernah "kurang"', () => {
    assert.equal(leafColorGrade(4, 3.5)?.phrase, 'cukup')
    for (const bwd of [3.5, 4, 4.5, 5]) {
      const g = leafColorGrade(bwd, 3.5)
      assert.ok(g && !g.phrase.includes('kurang') && !g.phrase.includes('di bawah'))
    }
  })

  it('BWD jauh di atas batas', () => {
    assert.equal(leafColorGrade(5, 3)?.phrase, 'jauh di atas batas')
    assert.equal(leafColorGrade(4.5, 3)?.phrase, 'cukup, di atas batas')
  })

  it('derajat berada di 0..1', () => {
    for (let bwd = 2; bwd <= 5; bwd += 0.5) {
      const g = leafColorGrade(bwd, 3.5)
      assert.ok(g)
      for (const v of Object.values(g.degrees)) assert.ok(v >= 0 && v <= 1)
    }
  })

  it('selaras dengan status resmi: di bawah batas selalu bernada kurang, tidak pernah cukup', () => {
    for (const bwd of [2, 2.5, 3, 3.4]) {
      const p = leafColorGrade(bwd, 3.5)?.phrase ?? ''
      assert.ok(/bawah|kurang/.test(p), `${bwd}: ${p}`)
    }
  })
})

describe('growthGrade', () => {
  it('tanpa GI mengembalikan null', () => {
    assert.equal(growthGrade(null), null)
  })

  it('di bawah 0,85 selalu terhambat (ambang resmi)', () => {
    assert.deepEqual(growthGrade(0.8), { stunted: true, phrase: 'terhambat (kerdil)' })
    assert.equal(growthGrade(0.849)?.stunted, true)
  })

  it('tepat 0,85 tidak terhambat, tapi disebut mendekati batas terhambat', () => {
    const g = growthGrade(0.85)
    assert.equal(g?.stunted, false)
    assert.match(g?.phrase ?? '', /mendekati batas terhambat/)
    assert.ok(!g?.phrase.startsWith('terhambat'))
  })

  it('0,97 dan 1 baik', () => {
    assert.match(growthGrade(0.97)?.phrase ?? '', /^baik/)
    assert.equal(growthGrade(1)?.phrase, 'baik')
  })

  it('0,9 sedikit di bawah standar', () => {
    assert.match(growthGrade(0.9)?.phrase ?? '', /^sedikit di bawah standar/)
  })
})

describe('yieldGrade', () => {
  it('tanpa nilai atau rata-rata mengembalikan null', () => {
    assert.equal(yieldGrade(null, 6, 8), null)
    assert.equal(yieldGrade(6, null, 8), null)
    assert.equal(yieldGrade(6, 0, 8), null)
  })

  it('sama dengan rata-rata: dekat rata-rata', () => {
    assert.equal(yieldGrade(6.3, 6.3, 8.4), 'dekat rata-rata varietas')
  })

  it('jauh di bawah rata-rata', () => {
    assert.equal(yieldGrade(4, 6.3, 8.4), 'di bawah rata-rata varietas')
  })

  it('jauh di atas rata-rata', () => {
    assert.match(yieldGrade(8, 6, null) ?? '', /di atas rata-rata varietas/)
  })

  it('peralihan di bawah ke dekat rata-rata', () => {
    const p = yieldGrade(5.5, 6.3, null) // rasio 0,87
    assert.match(p ?? '', /di bawah rata-rata varietas|dekat rata-rata varietas/)
  })

  it('mendekati potensi varietas', () => {
    assert.match(yieldGrade(8, 6, 8.4) ?? '', /mendekati potensi varietas/)
    assert.doesNotMatch(yieldGrade(6.3, 6.3, 8.4) ?? '', /potensi/)
  })
})

describe('confidenceWord', () => {
  it('ambang 0,6 dan 0,8 selaras dengan kartu', () => {
    assert.equal(confidenceWord(0.5), 'rendah')
    assert.equal(confidenceWord(0.6), 'sedang')
    assert.equal(confidenceWord(0.7), 'sedang')
    assert.equal(confidenceWord(0.8), 'tinggi')
    assert.equal(confidenceWord(null), null)
  })
})
