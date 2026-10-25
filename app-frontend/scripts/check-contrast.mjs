// Verifies WCAG contrast of the design tokens in src/app/globals.css for light AND dark themes.
// Text pairs must reach 4.5:1 (AA); non-text UI boundaries/focus rings must reach 3:1.
// Run: npm run check:contrast
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/app/globals.css'), 'utf8')

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`Selector not found: ${selector}`)
  return css.slice(start, css.indexOf('\n  }', start))
}

function tokens(selector) {
  const out = {}
  for (const m of block(selector).matchAll(/--([a-z-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*;/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
  }
  return out
}

function toRgb([h, s, l]) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(fg, bg) {
  const a = luminance(toRgb(fg))
  const b = luminance(toRgb(bg))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// [foreground token, background token, minimum ratio, what it protects]
const PAIRS = [
  ['foreground', 'background', 4.5, 'body text'],
  ['card-foreground', 'card', 4.5, 'card text'],
  ['popover-foreground', 'popover', 4.5, 'popover/menu text'],
  ['primary-foreground', 'primary', 4.5, 'primary button/badge text'],
  ['secondary-foreground', 'secondary', 4.5, 'secondary button/badge text'],
  ['accent-foreground', 'accent', 4.5, 'hover/focus item text'],
  ['destructive-foreground', 'destructive', 4.5, 'destructive button/badge text'],
  ['success-foreground', 'success', 4.5, 'success badge text'],
  ['warning-foreground', 'warning', 4.5, 'warning badge text'],
  ['info-foreground', 'info', 4.5, 'info badge text'],
  ['muted-foreground', 'background', 4.5, 'secondary text on page'],
  ['muted-foreground', 'card', 4.5, 'secondary text on cards'],
  ['muted-foreground', 'muted', 4.5, 'secondary text on muted surfaces'],
  ['muted-foreground', 'accent', 4.5, 'secondary text on hover surface'],
  ['primary', 'background', 4.5, 'primary-coloured text/links on page'],
  ['primary', 'card', 4.5, 'primary-coloured text on cards'],
  ['destructive', 'background', 4.5, 'error text on page'],
  ['destructive', 'card', 4.5, 'error text on cards'],
  ['input', 'background', 3, 'form control border (non-text)'],
  ['input', 'card', 3, 'form control border on cards (non-text)'],
  ['ring', 'background', 3, 'focus ring (non-text)'],
]

let failures = 0
for (const [theme, selector] of [['light', ':root'], ['dark', '.dark']]) {
  const t = tokens(selector)
  console.log(`\n${theme.toUpperCase()}`)
  for (const [fg, bg, min, label] of PAIRS) {
    if (!t[fg] || !t[bg]) {
      console.log(`  ?    missing token ${!t[fg] ? fg : bg}  (${label})`)
      failures++
      continue
    }
    const r = ratio(t[fg], t[bg])
    const ok = r >= min
    if (!ok) failures++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)} (need ${min})  ${fg} on ${bg}  - ${label}`)
  }
}

if (failures) {
  console.error(`\n${failures} contrast check(s) failed.`)
  process.exit(1)
}
console.log('\nAll contrast checks passed.')
