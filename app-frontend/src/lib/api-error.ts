import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/** Error body returned by the backend for every failed request. */
export interface ApiErrorBody {
  code?: string
  message?: string | string[]
  fields?: Record<string, string[]>
}

const bodyOf = (error: unknown): ApiErrorBody | undefined =>
  (error as { response?: { data?: ApiErrorBody } })?.response?.data

/** User-facing message from an API error, or `fallback` (e.g. on a network failure). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = bodyOf(error)?.message
  if (Array.isArray(message)) return message.join(', ') || fallback
  return message || fallback
}

/**
 * Pins backend VALIDATION_ERROR messages onto the matching form fields.
 * Returns true when at least one field was set, so the caller can skip the generic toast.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const fields = bodyOf(error)?.fields
  if (!fields) return false
  let applied = false
  for (const [name, messages] of Object.entries(fields)) {
    if (!messages?.length) continue
    setError(name as Path<T>, { type: 'server', message: messages.join(', ') })
    applied = true
  }
  return applied
}
