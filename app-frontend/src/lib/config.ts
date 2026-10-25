// Shared constants. No framework/store imports so this stays safe to use from middleware (edge runtime).

/** Presence flag cookie read by middleware.ts; UX only, the backend authorizes every request. */
export const SESSION_FLAG = 'agro_session'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
