'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { escapeHtml } from '@/lib/utils'
import { L, MAP_STYLES, KIND_LABEL, createMarkerIcon, glyphSvg } from '@/components/maps/leaflet-setup'
import {
  COORD_SOURCE_LABEL,
  N_STATUS,
  isCamera,
  paramLine,
  parametersBySensor,
  PIN_COLOR,
  PIN_COLOR_ACTIVE,
  leafColor,
  nStatus,
  polygonLatLngs,
  resolveCoord,
  samplePoints,
  type NStatus,
  type ResolvedCoord,
  type SensorParam,
  type SitePlant,
  type TwinMapData,
  type TwinMedia,
} from '@/lib/twin'

export type ColorMode = 'visual' | 'nitrogen'

interface PlotMapProps {
  plants: SitePlant[]
  mapData: TwinMapData | undefined
  /** parameter sensor, hanya sebagai keterangan di popup */
  parameters: SensorParam[]
  selectedId: string
  mode: ColorMode
  /** warna fase tanaman terpilih pada tanggal slider */
  phaseColor: string | null
  /** BWD pada tanggal slider dan batas fase, untuk warna daun / status N */
  bwd: number | null
  bwdMin: number | null
  media: TwinMedia[]
  selectedMediaId: string | null
  onSelectPlant: (plantId: string) => void
  onSelectMedia: (mediaId: string) => void
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const NO_PHASE = '#BDBDBD'

const pinIcon = (active: boolean, estimated: boolean) =>
  L.divIcon({
    className: 'agro-marker agro-marker-photo',
    html: `<svg width="26" height="34" viewBox="-13 -34 26 34" style="opacity:${estimated ? 0.65 : 1};filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))" aria-hidden="true"><path d="M0 0 C-11 -14 -11 -26 0 -26 C11 -26 11 -14 0 0Z" transform="translate(0 -2) scale(1.2)" fill="${active ? PIN_COLOR_ACTIVE : PIN_COLOR}" stroke="#fff" stroke-width="1.5"/><circle cy="-22" r="3.5" fill="#fff"/></svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
  })

const popup = (kind: 'site' | 'device' | 'sensor', name: string, coord: ResolvedCoord, extra = '') =>
  `<div class="agro-popup"><h3>${glyphSvg(kind, 16)}<span>${escapeHtml(name)}</span></h3>${extra}<p class="muted">${escapeHtml(KIND_LABEL[kind])} · ${escapeHtml(COORD_SOURCE_LABEL[coord.source])}</p></div>`

/**
 * Peta OpenStreetMap petak: poligon berwarna fase / status N, titik sampel BWD, foto bergeotag,
 * perangkat, sensor, dan site. Data tanpa koordinat dipasang di koordinat petak lalu site.
 */
export function PlotMap({ plants, mapData, parameters, selectedId, mode, phaseColor, bwd, bwdMin, media, selectedMediaId, onSelectPlant, onSelectMedia }: PlotMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layers = useRef<Record<'plots' | 'samples' | 'photos' | 'devices' | 'sensors' | 'sites', L.LayerGroup> | null>(null)
  const fittedFor = useRef<string>('')
  const [tilesFailed, setTilesFailed] = useState(false)

  // handlers lewat ref supaya peta tidak dibangun ulang tiap render induk
  const onPlant = useRef(onSelectPlant)
  const onMedia = useRef(onSelectMedia)
  onPlant.current = onSelectPlant
  onMedia.current = onSelectMedia

  const status: NStatus = nStatus(bwd, bwdMin)
  const selected = plants.find((p) => p.plant_id === selectedId)

  const sitesById = useMemo(() => new Map((mapData?.sites ?? []).map((s) => [s.site_id, s])), [mapData])

  /** koordinat petak: titik sendiri, lalu site */
  const plantCoord = useCallback(
    (p: SitePlant | undefined) => {
      if (!p) return null
      const site = sitesById.get(p.site_id)
      return resolveCoord({ lat: p.lat, lon: p.lon }, [{ source: 'site', lat: site?.lat, lon: site?.lon }])
    },
    [sitesById],
  )

  // semua yang tergambar di peta, dihitung sekali per perubahan data
  const scene = useMemo(() => {
    const fill = (id: string, p: SitePlant): string => {
      if (id !== selectedId) return p.phase?.color ?? NO_PHASE
      if (mode === 'nitrogen') return N_STATUS[status].color
      return bwd === null ? phaseColor ?? '#9CCC65' : leafColor(bwd)
    }
    const plots = plants.map((p) => ({ p, ring: polygonLatLngs(p.geom), coord: plantCoord(p), color: fill(p.plant_id, p), active: p.plant_id === selectedId }))
    const selPlot = plots.find((x) => x.active)
    const sel = selPlot?.coord

    const photos = media.flatMap((m) => {
      const coord = resolveCoord({ lat: m.lat, lon: m.lon }, [{ source: 'plant', lat: sel?.lat, lon: sel?.lon }])
      return coord ? [{ m, coord }] : []
    })

    const deviceCoord = (d: TwinMapData['devices'][number]) => {
      const site = sitesById.get(d.site_id)
      return resolveCoord({ lat: d.lat, lon: d.lon }, [{ source: 'site', lat: site?.lat, lon: site?.lon }])
    }
    // kamera disimpan bersama pengendalinya: tidak digambar sendiri, disebut di popup pengendali
    const cameraNames = new Map<string, string[]>()
    for (const s of mapData?.sensors ?? []) if (isCamera(s.type)) cameraNames.set(s.dev_id, [...(cameraNames.get(s.dev_id) ?? []), s.name ?? s.sens_id])
    const bySens = parametersBySensor(parameters)
    const devices = (mapData?.devices ?? []).flatMap((d) => {
      const coord = deviceCoord(d)
      return coord ? [{ d, coord, cameras: cameraNames.get(d.dev_id) ?? [] }] : []
    })
    const deviceById = new Map((mapData?.devices ?? []).map((d) => [d.dev_id, d]))
    // sensor tanpa koordinat: titik perangkatnya, lalu site
    const sensors = (mapData?.sensors ?? []).flatMap((s) => {
      if (isCamera(s.type)) return []
      const dev = deviceById.get(s.dev_id)
      const parent = dev ? deviceCoord(dev) : null
      const coord = resolveCoord({ lat: s.lat, lon: s.lon }, parent ? [{ source: parent.source === 'own' ? 'device' : 'site', lat: parent.lat, lon: parent.lon }] : [])
      return coord ? [{ s, coord, params: bySens.get(s.sens_id) ?? [] }] : []
    })
    const sites = (mapData?.sites ?? []).flatMap((s) => {
      const coord = resolveCoord({ lat: s.lat, lon: s.lon })
      return coord ? [{ s, coord }] : []
    })

    const selRing = selPlot?.ring ?? null
    return {
      plots,
      selPlot,
      hasPlots: plots.some((x) => x.ring || x.coord),
      photos,
      devices,
      sensors,
      sites,
      samples: selRing ? samplePoints(selRing) : [],
    }
  }, [plants, mapData, parameters, selectedId, mode, phaseColor, bwd, status, media, sitesById, plantCoord])

  const hasAnything = scene.hasPlots || scene.sites.length > 0

  // peta dibuat sekali
  useEffect(() => {
    if (!box.current || !hasAnything || mapRef.current) return
    const map = L.map(box.current, { scrollWheelZoom: false, keyboard: true }).setView([-2.5, 118], 5)
    mapRef.current = map
    L.tileLayer(OSM_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
      .on('tileerror', () => setTilesFailed(true))
      .on('tileload', () => setTilesFailed(false))
      .addTo(map)

    const g = {
      plots: L.layerGroup().addTo(map),
      samples: L.layerGroup().addTo(map),
      photos: L.layerGroup().addTo(map),
      devices: L.layerGroup().addTo(map),
      sensors: L.layerGroup().addTo(map),
      sites: L.layerGroup().addTo(map),
    }
    layers.current = g
    L.control
      .layers(undefined, { Petak: g.plots, 'Titik pengamatan warna daun': g.samples, Foto: g.photos, Perangkat: g.devices, Sensor: g.sensors, Lokasi: g.sites }, { collapsed: true })
      .addTo(map)

    // zoom roda hanya setelah peta diaktifkan, supaya halaman tetap bisa di-scroll
    const on = () => map.scrollWheelZoom.enable()
    const off = () => map.scrollWheelZoom.disable()
    map.on('click focus', on)
    map.on('mouseout blur', off)

    return () => {
      map.off()
      map.remove()
      mapRef.current = null
      layers.current = null
      fittedFor.current = ''
    }
  }, [hasAnything])

  // gambar ulang lapisan saat data berubah (slider mengubah warna)
  useEffect(() => {
    const g = layers.current
    if (!g) return
    Object.values(g).forEach((l) => l.clearLayers())

    // petak terpilih digambar terakhir supaya di atas
    const ordered = [...scene.plots].sort((a, b) => Number(a.active) - Number(b.active))
    for (const { p, ring, coord, color, active } of ordered) {
      const label = `${p.name ?? p.plant_id}${p.phase ? ` · ${p.phase.name}` : ''}`
      let shape: L.Layer | null = null
      if (ring) {
        shape = L.polygon(ring, { color: active ? '#111' : '#616161', weight: active ? 3 : 1, fillColor: color, fillOpacity: active ? 0.75 : 0.5 })
      } else if (coord) {
        shape = L.circleMarker([coord.lat, coord.lon], { radius: active ? 11 : 8, color: active ? '#111' : '#616161', weight: active ? 3 : 1, fillColor: color, fillOpacity: 0.85 })
      }
      if (!shape) continue
      shape.bindTooltip(escapeHtml(label) + (ring ? '' : ` — ${COORD_SOURCE_LABEL[coord?.source ?? 'own']}, batas petak belum digambar`), { sticky: true })
      shape.on('click', () => onPlant.current(p.plant_id))
      shape.addTo(g.plots)
    }

    scene.samples.forEach(([lat, lon], i) =>
      L.circleMarker([lat, lon], { radius: 3, color: '#212121', weight: 1, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(`Titik pengamatan warna daun ${i + 1}`).addTo(g.samples),
    )

    scene.photos.forEach(({ m, coord }) => {
      const date = m.date ? m.date.slice(0, 10) : ''
      const estimated = coord.source !== 'own'
      L.marker([coord.lat, coord.lon], {
        icon: pinIcon(m.media_id === selectedMediaId, estimated),
        title: `Foto ${date}${estimated ? ' (lokasi perkiraan)' : ''}`,
        alt: `Foto ${date}`,
        keyboard: true,
        zIndexOffset: m.media_id === selectedMediaId ? 1000 : 0,
      })
        .on('click', () => onMedia.current(m.media_id))
        .addTo(g.photos)
    })

    scene.devices.forEach(({ d, coord, cameras }) =>
      L.marker([coord.lat, coord.lon], { icon: createMarkerIcon('device'), title: `Perangkat: ${d.name ?? d.dev_id}`, alt: `Perangkat: ${d.name ?? d.dev_id}`, keyboard: true })
        .bindPopup(popup('device', d.name ?? d.dev_id, coord, cameras.length ? `<p>Kamera: ${escapeHtml(cameras.join(', '))}</p>` : ''))
        .addTo(g.devices),
    )
    scene.sensors.forEach(({ s, coord, params }) =>
      L.marker([coord.lat, coord.lon], { icon: createMarkerIcon('sensor'), title: `Sensor: ${s.name ?? s.sens_id}`, alt: `Sensor: ${s.name ?? s.sens_id}`, keyboard: true })
        .bindPopup(popup('sensor', s.name ?? s.sens_id, coord, [s.type ? `<p>${escapeHtml(s.type)}</p>` : '', ...params.map((p) => `<p class="muted">${escapeHtml(paramLine(p))}</p>`)].join('')))
        .addTo(g.sensors),
    )
    scene.sites.forEach(({ s, coord }) =>
      L.marker([coord.lat, coord.lon], { icon: createMarkerIcon('site'), title: `Lokasi: ${s.name ?? s.site_id}`, alt: `Lokasi: ${s.name ?? s.site_id}`, keyboard: true })
        .bindPopup(popup('site', s.name ?? s.site_id, coord))
        .addTo(g.sites),
    )
  }, [scene, selectedMediaId, hasAnything])

  // zoom ke petak terpilih hanya saat petak berganti (bukan tiap geser slider)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const key = `${selectedId}|${scene.hasPlots ? 1 : 0}`
    if (fittedFor.current === key) return
    const sel = scene.selPlot
    if (sel?.ring) map.fitBounds(L.latLngBounds(sel.ring), { padding: [40, 40], maxZoom: 18 })
    else if (sel?.coord) map.setView([sel.coord.lat, sel.coord.lon], 16)
    else if (scene.sites.length) map.fitBounds(L.latLngBounds(scene.sites.map((x) => [x.coord.lat, x.coord.lon] as [number, number])), { padding: [40, 40], maxZoom: 15 })
    else return
    fittedFor.current = key
  }, [selectedId, scene, hasAnything])

  if (!hasAnything) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center">
        <div className="h-16 w-16 rounded-md border" style={{ backgroundColor: phaseColor ?? NO_PHASE }} aria-hidden="true" />
        <p className="font-medium">{selected?.name ?? 'Petak'}</p>
        <p className="text-sm text-muted-foreground">Petak dan site belum punya koordinat, jadi peta tidak dapat ditampilkan.</p>
      </div>
    )
  }

  const selCoord = scene.selPlot?.coord
  const approx = scene.selPlot && !scene.selPlot.ring

  return (
    <figure className="agro-map space-y-3">
      <style>{MAP_STYLES}</style>
      <div
        ref={box}
        role="region"
        aria-label={`Peta petak ${selected?.name ?? selected?.plant_id ?? ''}${mode === 'nitrogen' ? `, kecukupan nitrogen ${N_STATUS[status].label}` : ''}`}
        className="z-0 h-[420px] w-full rounded-lg border bg-muted/30"
      />
      {tilesFailed && (
        <p role="status" className="text-sm text-muted-foreground">
          Peta dasar OpenStreetMap tidak dapat dimuat (periksa koneksi internet). Petak dan penanda tetap ditampilkan.
        </p>
      )}
      {approx && (
        <p className="text-sm text-muted-foreground">
          Batas petak belum digambar; petak ditandai di {selCoord ? COORD_SOURCE_LABEL[selCoord.source] : 'lokasi tidak diketahui'}.
        </p>
      )}
      <figcaption className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {mode === 'nitrogen' ? (
          (Object.keys(N_STATUS) as NStatus[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: N_STATUS[k].color }} aria-hidden="true" />
              {N_STATUS[k].label}
            </span>
          ))
        ) : (
          <span>Warna petak terpilih mengikuti warna daun terakhir; petak lain mengikuti tahap tumbuh.</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-foreground bg-white" aria-hidden="true" />
          Titik pengamatan warna daun
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIN_COLOR }} aria-hidden="true" />
          Foto
        </span>
        <span>Foto, perangkat, dan sensor tanpa koordinat dipasang di titik petak atau lokasi.</span>
      </figcaption>
    </figure>
  )
}
