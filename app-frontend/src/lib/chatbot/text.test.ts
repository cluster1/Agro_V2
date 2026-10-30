import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fuzzyEqual, editDistance, normalize, stem, tokenize, wordScore } from './text.ts'

describe('normalize', () => {
  it('huruf kecil, tanpa tanda baca dan aksen', () => {
    assert.equal(normalize('  Kenapa PERKIRAAN hasil 6,3?! '), 'kenapa perkiraan hasil 6 3')
    assert.equal(normalize('Café'), 'cafe')
  })
})

describe('stem', () => {
  it('memangkas imbuhan umum secara konsisten', () => {
    assert.equal(stem('perkiraan'), stem('diperkirakan'))
    assert.equal(stem('peringatan'), stem('peringatan'))
    assert.equal(stem('hasil'), 'hasil')
  })

  it('tidak memangkas kata pendek', () => {
    assert.equal(stem('bwd'), 'bwd')
    assert.equal(stem('hara'), 'hara')
    assert.equal(stem('apa'), 'apa')
  })
})

describe('tokenize', () => {
  it('memecah kalimat menjadi kata berstem', () => {
    assert.deepEqual(tokenize('Hara petak ini'), ['hara', 'petak', 'ini'])
  })
})

describe('editDistance', () => {
  it('menghitung jarak edit', () => {
    assert.equal(editDistance('nitrogen', 'nitrogn'), 1)
    assert.equal(editDistance('abc', 'abc'), 0)
    assert.equal(editDistance('', 'abc'), 3)
    assert.equal(editDistance('kitten', 'sitting'), 3)
    assert.equal(editDistance('prediski', 'prediksi'), 1)
  })
})

describe('fuzzyEqual', () => {
  it('toleran salah ketik pada kata panjang', () => {
    assert.equal(fuzzyEqual('nitrogn', 'nitrogen'), true)
    assert.equal(fuzzyEqual('prediski', 'prediksi'), true)
    assert.equal(fuzzyEqual('perkiraan', 'perkirann'), true)
  })

  it('kata pendek harus persis', () => {
    assert.equal(fuzzyEqual('bwd', 'bwa'), false)
    assert.equal(fuzzyEqual('hara', 'hari'), false)
  })

  it('huruf pertama harus sama', () => {
    assert.equal(fuzzyEqual('sensor', 'tensor'), false)
  })

  it('kata berbeda jauh tidak cocok', () => {
    assert.equal(fuzzyEqual('jadwal', 'cuaca'), false)
  })
})

describe('wordScore', () => {
  it('1 persis, 0,7 kabur, 0 tidak cocok', () => {
    assert.equal(wordScore('hasil', 'hasil'), 1)
    assert.equal(wordScore('hasl', 'hasil'), 0.7)
    assert.equal(wordScore('has', 'hasil'), 0)
    assert.equal(wordScore('nitrogn', 'nitrogen'), 0.7)
    assert.equal(wordScore('jadwal', 'cuaca'), 0)
  })
})
