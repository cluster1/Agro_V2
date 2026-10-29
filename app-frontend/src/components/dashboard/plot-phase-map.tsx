'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { escapeHtml } from '@/lib/utils'
import { L, MAP_STYLES } from '@/components/maps/leaflet-setup'
import { COORD_SOURCE_LABEL, polygonLatLngs, resolveCoord, type SitePlant, type TwinMapData } from '@/lib/twin'

interface PlotPhaseMapProps {
  plants: SitePlant[]
  sites: TwinMapData['sites']
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const NO_PHASE = '#BDBDBD'
const NO_PHASE_LABEL = 'Belum ada fase'

/** Peta OpenStreetMap seluruh petak aktif, diwarnai menurut fase. Petak tanpa batas digambar di titiknya, lalu di site. */
export function PlotPhaseMap({ plants, sites }: PlotPhaseMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fittedFor = useRef('')
  const [tilesFailed, setTilesFailed] = useState(false)

  const shapes = useMemo(() => {
    const siteById = new Map(sites.map((s) => [s.site_id, s]))
    return plants.flatMap((p) => {
      const ring = polygonLatLngs(p.geom)
      const site = siteById.get(p.site_id)
      const coord = resolveCoord({ lat: p.lat, lon: p.lon }, [{ source: 'site', lat: site?.lat, lon: site?.lon }])
      return ring || coord ? [{ p, ring, coord, color: p.phase?.color ?? NO_PHASE }] : []
    })
  }, [plants, sites])

  const legend = useMemo(() => {
    const byName = new Map<string, { color: string; seq: number }>()
    for (const { p, color } of shapes) byName.set(p.phase?.name ?? NO_PHASE_LABEL, { color, seq: p.phase?.seq ?? 999 })
    return [...byName.entries()].sort((a, b) => a[1].seq - b[1].seq)
  }, [shapes])

  const hasShapes = shapes.length > 0

  useEffect(() => {
    if (!box.current || !hasShapes || mapRef.current) return
    const map = L.map(box.current, { scrollWheelZoom: false, keyboard: true }).setView([-2.5, 118], 5)
    mapRef.current = map
    L.tileLayer(OSM_URL, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 })
      .on('tileerror', () => setTilesFailed(true))
      .on('tileload', () => setTilesFailed(false))
      .addTo(map)
    layer.current = L.layerGroup().addTo(map)
    // zoom roda hanya setelah peta diaktifkan, supaya halaman tetap bisa di-scroll
    map.on('click focus', () => map.scrollWheelZoom.enable())
    map.on('mouseout blur', () => map.scrollWheelZoom.disable())
    return () => {
      map.off()
      map.remove()
      mapRef.current = null
      layer.current = null
      fittedFor.current = ''
    }
  }, [hasShapes])

  useEffect(() => {
    const map = mapRef.current
    const g = layer.current
    if (!map || !g) return
    g.clearLayers()
    const points: [number, number][] = []
    for (const { p, ring, coord, color } of shapes) {
      const label = `${p.name ?? p.plant_id} · ${p.phase?.name ?? NO_PHASE_LABEL}`
      const note = ring ? '' : ` — ${COORD_SOURCE_LABEL[coord?.source ?? 'own']}, batas petak belum digambar`
      if (ring) {
        L.polygon(ring, { color: '#616161', weight: 1, fillColor: color, fillOpacity: 0.6 }).bindTooltip(escapeHtml(label) + note, { sticky: true }).addTo(g)
        points.push(...ring)
      } else if (coord) {
        L.circleMarker([coord.lat, coord.lon], { radius: 8, color: '#616161', weight: 1, fillColor: color, fillOpacity: 0.85 }).bindTooltip(escapeHtml(label) + note, { sticky: true }).addTo(g)
        points.push([coord.lat, coord.lon])
      }
    }
    // zoom hanya saat kumpulan petak berganti, bukan tiap data di-refetch
    const key = shapes.map((s) => s.p.plant_id).join('|')
    if (points.length && fittedFor.current !== key) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 })
      fittedFor.current = key
    }
  }, [shapes, hasShapes])

  if (!hasShapes) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center">
        <p className="font-medium">Belum ada petak yang bisa dipetakan</p>
        <p className="text-sm text-muted-foreground">Petak dan site belum punya koordinat atau batas petak.</p>
      </div>
    )
  }

  return (
    <figure className="agro-map space-y-3">
      <style>{MAP_STYLES}</style>
      <div ref={box} role="region" aria-label="Peta petak menurut fase" className="z-0 h-[420px] w-full rounded-lg border bg-muted/30" />
      {tilesFailed && (
        <p role="status" className="text-sm text-muted-foreground">
          Peta dasar OpenStreetMap tidak dapat dimuat (periksa koneksi internet). Petak tetap ditampilkan.
        </p>
      )}
      <figcaption className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map(([name, { color }]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: color }} aria-hidden="true" />
            {name}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
