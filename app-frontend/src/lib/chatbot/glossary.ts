import { normalize } from './text.ts'
import { fuzzyEqual } from './text.ts'

export interface GlossaryEntry {
  id: string
  /** istilah yang dikenali, sudah dinormalisasi (huruf kecil, tanpa tanda baca) */
  terms: string[]
  title: string
  text: string
}

/** Kamus istilah; kalimat selaras dengan istilah di antarmuka dan app-docs/MODUL_AGROTWIN.md. */
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'bwd',
    terms: ['bwd', 'bagan warna daun'],
    title: 'BWD (Bagan Warna Daun)',
    text: 'Kartu warna skala 2 sampai 5 untuk menilai kecukupan nitrogen dari warna daun. Makin hijau tua, makin cukup nitrogennya. Nilainya dibandingkan dengan batas minimal tiap tahap tumbuh, dan hanya dicatat pada umur 14 sampai 62 hari setelah tanam.',
  },
  {
    id: 'hst',
    terms: ['hst', 'hari setelah tanam'],
    title: 'Umur (HST)',
    text: 'Hari setelah tanam pindah. Di aplikasi ditulis "umur ... hari".',
  },
  {
    id: 'gdd',
    terms: ['gdd', 'growing degree days'],
    title: 'GDD',
    text: 'Growing degree days: akumulasi suhu harian di atas suhu dasar varietas. Dipakai untuk menentukan tahap tumbuh dan perkiraan tanggal panen.',
  },
  {
    id: 'gkp',
    terms: ['gkp', 'gabah kering panen'],
    title: 'GKP',
    text: 'Gabah kering panen: gabah yang baru dipanen dan masih berkadar air tinggi.',
  },
  {
    id: 'gkg',
    terms: ['gkg', 'gabah kering giling'],
    title: 'GKG',
    text: 'Gabah kering giling: gabah berkadar air 14 persen. Hasil panen dihitung GKG = GKP × (100 − kadar air) ÷ (100 − 14).',
  },
  {
    id: 'gi',
    terms: ['indeks pertumbuhan'],
    title: 'Indeks pertumbuhan',
    text: 'Rata-rata perbandingan tinggi dan jumlah anakan hasil pengamatan terhadap standar varietas, paling besar 1. Di bawah 0,85 berarti terhambat (kerdil), dan sebaiknya petugas memeriksa tanaman di lapangan.',
  },
  {
    id: 'npk',
    terms: ['nitrogen', 'fosfor', 'kalium', 'npk'],
    title: 'Nitrogen, fosfor, kalium',
    text: 'Tiga unsur hara utama (N, P, K). Kekurangannya dihitung dalam kg per hektar. Nitrogen dinilai dari warna daun (BWD); fosfor dan kalium dari status tanah hasil uji lab dikurangi pupuk yang sudah diberikan.',
  },
  {
    id: 'pupuk',
    terms: ['urea', 'sp36', 'sp 36', 'kcl'],
    title: 'Urea, SP-36, KCl',
    text: 'Pupuk tunggal: urea mengandung nitrogen 46 persen, SP-36 mengandung fosfat (P₂O₅) 36 persen, dan KCl mengandung kalium (K₂O) 60 persen.',
  },
  {
    id: 'legowo',
    terms: ['jajar legowo', 'legowo'],
    title: 'Jajar legowo',
    text: 'Pola tanam dengan beberapa barisan rapat dan satu lorong kosong. Model 3D memakai pola ini sebagai gambaran petak.',
  },
  {
    id: 'ubinan',
    terms: ['ubinan'],
    title: 'Ubinan',
    text: 'Panen contoh pada petak kecil untuk menaksir hasil per hektar. Hasilnya dipakai sebagai pembanding perkiraan.',
  },
  {
    id: 'status-param',
    terms: ['estimasi', 'kalibrasi'],
    title: 'ESTIMASI dan KALIBRASI',
    text: 'Status parameter model. ESTIMASI berarti nilai awal yang perlu divalidasi penyuluh. KALIBRASI berarti sudah disesuaikan dengan data lapangan.',
  },
  {
    id: 'tahap',
    terms: ['tahap tumbuh', 'fase'],
    title: 'Tahap tumbuh',
    text: 'Tahap pertumbuhan padi, mulai persemaian sampai siap panen. Tanggal mulai tiap tahap dihitung dari akumulasi suhu harian (GDD).',
  },
  {
    id: 'perkiraan',
    terms: ['perkiraan hasil', 'tingkat kepastian', 'rentang kemungkinan'],
    title: 'Perkiraan hasil dan tingkat kepastian',
    text: 'Perkiraan hasil panen dalam ton per hektar gabah kering. Rentang menunjukkan batas kemungkinan. Tingkat kepastian 50 persen sebelum berbunga (perkiraan awal dari rata-rata varietas), dan naik menjadi 70 persen bila ada hitungan malai dan gabah.',
  },
]

/** Cari istilah kamus di teks pengguna: frasa persis, atau kata tunggal dengan toleransi salah ketik. */
export function findGlossary(input: string): GlossaryEntry | null {
  const text = ` ${normalize(input)} `
  const words = text.trim().split(' ')
  for (const entry of GLOSSARY) {
    for (const term of entry.terms) {
      if (term.includes(' ')) {
        if (text.includes(` ${term} `)) return entry
      } else if (words.some((w) => w === term || (term.length >= 5 && fuzzyEqual(w, term)))) {
        return entry
      }
    }
  }
  return null
}
