import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_URL } from "./config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Escapes text for safe interpolation into HTML strings (e.g. Leaflet popups,
 * which render string content via innerHTML).
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds an absolute URL for a backend-served upload (e.g. "uploads/tenant-logos/x.png")
 * from the API origin instead of a hardcoded host. An absolute URL is only accepted when it
 * points at that same origin; anything else yields '' so a stored external URL cannot make
 * every viewer's browser contact a third-party host.
 */
export function uploadUrl(path: string): string {
  const origin = new URL(API_URL).origin
  if (/^https?:\/\//i.test(path)) {
    try {
      return new URL(path).origin === origin ? path : ''
    } catch {
      return ''
    }
  }
  return `${origin}/${path.replace(/^(\.\/|\/)+/, '')}`
}
