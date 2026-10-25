import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Default marker icons are served from the bundled leaflet package (no third-party CDN).
// Leaflet's own URL auto-detection breaks under bundlers, so it is replaced once here.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
})

export type MarkerKind = 'site' | 'device' | 'sensor'

/** Same lucide glyph paths used by the React legend, so legend and markers always match. */
const GLYPHS: Record<MarkerKind, string> = {
  site: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  device:
    '<path d="M5 16v2"/><path d="M19 16v2"/><rect width="20" height="8" x="2" y="8" rx="2"/><path d="M18 12h0"/>',
  sensor:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
}

/** Theme tokens for each kind (foreground is the token paired with the background for contrast). */
export const KIND_TOKENS: Record<MarkerKind, { bg: string; fg: string }> = {
  site: { bg: 'var(--primary)', fg: 'var(--primary-foreground)' },
  device: { bg: 'var(--info)', fg: 'var(--info-foreground)' },
  sensor: { bg: 'var(--warning)', fg: 'var(--warning-foreground)' },
}

export const KIND_LABEL: Record<MarkerKind, string> = {
  site: 'Site',
  device: 'Perangkat',
  sensor: 'Sensor',
}

const SIZES: Record<MarkerKind, { box: number; glyph: number; border: number }> = {
  site: { box: 32, glyph: 18, border: 3 },
  device: { box: 28, glyph: 15, border: 2 },
  sensor: { box: 24, glyph: 13, border: 2 },
}

/** Inline SVG string for popups (uses currentColor). */
export function glyphSvg(kind: MarkerKind, size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPHS[kind]}</svg>`
}

export function createMarkerIcon(kind: MarkerKind): L.DivIcon {
  const { box, glyph, border } = SIZES[kind]
  const { bg, fg } = KIND_TOKENS[kind]
  return L.divIcon({
    className: `agro-marker agro-marker-${kind}`,
    html: `<div style="background-color:hsl(${bg});color:hsl(${fg});width:${box}px;height:${box}px;border-radius:50%;border:${border}px solid hsl(var(--background));box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">${glyphSvg(kind, glyph)}</div>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
    popupAnchor: [0, -box / 2],
  })
}

/** Popup + hint styles, scoped to `.agro-map`. Tokens switch with the theme, so popups work in dark mode. */
export const MAP_STYLES = `
.agro-map .leaflet-popup-content-wrapper,
.agro-map .leaflet-popup-tip {
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
}
.dark .agro-map .leaflet-popup-content-wrapper,
.dark .agro-map .leaflet-popup-tip {
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
}
.agro-map .leaflet-popup-close-button { color: hsl(var(--muted-foreground)); width: 32px; height: 32px; font-size: 22px; line-height: 32px; }
.agro-map .leaflet-popup-close-button:hover { color: hsl(var(--foreground)); }
.agro-map .agro-popup { font-family: inherit; font-size: 13px; line-height: 1.4; }
.agro-map .agro-popup h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 14px; font-weight: 700; color: hsl(var(--popover-foreground)); }
.agro-map .agro-popup p { margin: 4px 0; font-size: 13px; color: hsl(var(--popover-foreground)); }
.agro-map .agro-popup .muted { font-size: 12px; color: hsl(var(--muted-foreground)); }
.agro-map .agro-popup .param { margin: 6px 0; padding: 8px; border-radius: 6px; border-left: 3px solid hsl(var(--primary)); background: hsl(var(--muted)); }
.agro-map .agro-popup .param .name { margin: 0; font-size: 12px; font-weight: 600; color: hsl(var(--muted-foreground)); }
.agro-map .agro-popup .param .value { margin: 2px 0 0; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: hsl(var(--popover-foreground)); }
.agro-map .agro-popup .param .when { margin: 2px 0 0; font-size: 12px; color: hsl(var(--muted-foreground)); }
.agro-map .agro-popup .count { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.agro-map .leaflet-marker-icon:focus-visible { outline: 3px solid hsl(var(--ring)); outline-offset: 2px; border-radius: 50%; }
`

export { L }
