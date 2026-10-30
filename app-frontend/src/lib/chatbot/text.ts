// Pengolah teks untuk chatbot. Hanya impor relatif (berekstensi .ts) agar bisa dites dengan `node --test`.

/** Huruf kecil, buang aksen dan tanda baca, rapikan spasi. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SUFFIXES = ['kan', 'nya', 'lah', 'kah', 'an', 'i']
const PREFIXES = ['meng', 'meny', 'mem', 'men', 'ber', 'ter', 'per', 'me', 'pe', 'di', 'ke', 'se']
const MIN_STEM = 4

/** Pangkas imbuhan umum bahasa Indonesia; sama untuk kata kunci dan masukan pengguna, jadi konsisten. */
export function stem(word: string): string {
  let w = word
  for (const s of SUFFIXES) {
    if (w.length - s.length >= MIN_STEM && w.endsWith(s)) {
      w = w.slice(0, -s.length)
      break
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const p = PREFIXES.find((x) => w.length - x.length >= MIN_STEM && w.startsWith(x))
    if (!p) break
    w = w.slice(p.length)
  }
  return w
}

/** Kata hasil normalisasi dan stemming. */
export function tokenize(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter(Boolean)
    .map(stem)
}

/** Jarak edit dengan penukaran dua huruf bersebelahan dihitung 1 (salah ketik yang umum, mis. "prediski"). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/**
 * Sama persis, atau beda sedikit karena salah ketik. Toleransi menurut panjang kata terpanjang:
 * di bawah 5 huruf harus persis, 5-8 huruf boleh 1 beda, 9 huruf ke atas boleh 2. Huruf pertama harus sama.
 */
export function fuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true
  const longest = Math.max(a.length, b.length)
  const allowed = longest < 5 ? 0 : longest < 9 ? 1 : 2
  if (allowed === 0 || a[0] !== b[0]) return false
  return editDistance(a, b) <= allowed
}

/** 1 bila kata persis sama, 0,7 bila kabur, 0 bila tidak cocok. */
export function wordScore(a: string, b: string): number {
  if (a === b) return 1
  return fuzzyEqual(a, b) ? 0.7 : 0
}
