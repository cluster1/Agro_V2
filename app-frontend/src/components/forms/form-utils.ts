import * as z from 'zod'

/** Prompt shown when a dirty dialog is dismissed (overlay / Esc / X / Batal). */
export const UNSAVED_MESSAGE = 'Perubahan belum disimpan. Tutup tanpa menyimpan?'

/** Optional phone number: digits, spaces, dashes, parentheses, optional leading "+". */
export const PHONE_REGEX = /^\+?[0-9][0-9\s\-()]{5,19}$/

/**
 * Optional number for a text/number input. An empty field becomes `undefined`
 * (NOT 0) while a legitimate `0` stays `0`.
 */
export const optionalNumber = (message = 'Harus berupa angka') =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ invalid_type_error: message }).optional()
  )

/** Payload helper: '' / null / undefined / NaN -> undefined, anything else -> Number (0 is kept). */
export const num = (v: unknown): number | undefined =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v)

/** Display helper for numeric inputs: keeps 0, shows '' for null/undefined. */
export const numDisplay = (v: unknown): string | number => (v === null || v === undefined ? '' : (v as string | number))

/**
 * Returns an `onOpenChange` handler that blocks closing while a request is pending and asks for
 * confirmation when the form has unsaved changes. Call the raw `onOpenChange(false)` directly after
 * a successful save so the guard does not trigger.
 */
export function guardedOpenChange(
  onOpenChange: (open: boolean) => void,
  opts: { isDirty: boolean; isBusy: boolean }
) {
  return (next: boolean) => {
    if (!next) {
      if (opts.isBusy) return
      if (opts.isDirty && !window.confirm(UNSAVED_MESSAGE)) return
    }
    onOpenChange(next)
  }
}
