'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Cpu, Radio, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import { paramState, type ParamState, type SceneController, type SceneSelection, type SceneSensor } from '@/lib/twin'

interface DeviceInfoProps {
  controllers: SceneController[]
  sensors: SceneSensor[]
  selection: SceneSelection | null
  onSelect: (selection: SceneSelection | null) => void
}

const STATE_LABEL: Record<ParamState, string> = {
  low: 'Di bawah batas',
  high: 'Di atas batas',
  ok: 'Normal',
  none: 'Tanpa batas / data',
}

const isHttpUrl = (v: string | null): v is string => !!v && /^https?:\/\//i.test(v)

function StateBadge({ state }: { state: ParamState }) {
  if (state === 'none') return <span className="text-xs text-muted-foreground">{STATE_LABEL.none}</span>
  const bad = state !== 'ok'
  return (
    <Badge variant={bad ? 'warning' : 'success'} className="gap-1">
      {bad ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
      {STATE_LABEL[state]}
    </Badge>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

/** Gambar perangkat; disembunyikan bila bukan URL http(s) atau gagal dimuat. */
function DeviceImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!isHttpUrl(src) || failed) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Gambar perangkat ${name}`} onError={() => setFailed(true)} className="h-32 w-full rounded-md border bg-muted object-contain" />
}

/**
 * Info objek yang diklik di model 3D (sensor atau perangkat). Tanpa pilihan, menampilkan daftar
 * perangkat dan sensor sebagai tombol, jadi info juga terjangkau lewat keyboard dan layar sentuh.
 */
export function DeviceInfo({ controllers, sensors, selection, onSelect }: DeviceInfoProps) {
  const controller = selection?.kind === 'controller' ? controllers.find((c) => c.dev_id === selection.id) : undefined
  const sensor = selection?.kind === 'sensor' ? sensors.find((s) => s.sens_id === selection.id) : undefined

  if (controllers.length === 0 && sensors.length === 0) return null

  const close = (
    <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={() => onSelect(null)} aria-label="Tutup info">
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  )

  return (
    <section className="rounded-lg border-2 p-4" aria-live="polite" aria-label="Info perangkat dan sensor">
      {controller ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Cpu className="h-5 w-5" aria-hidden="true" />
              Station Kit {controller.name}
            </h3>
            {close}
          </div>
          <DeviceImage src={controller.image} name={controller.name} />
          <dl className="space-y-1 text-sm">
            <Row label="ID perangkat">{controller.dev_id}</Row>
            {controller.number_id && <Row label="Nomor">{controller.number_id}</Row>}
            <Row label="Status">
              <Badge variant={controller.status === 1 ? 'success' : 'outline'}>{controller.status === 1 ? 'Aktif' : controller.status === null ? 'Tidak diketahui' : 'Nonaktif'}</Badge>
            </Row>
            {controller.location && <Row label="Lokasi">{controller.location}</Row>}
            {controller.lat !== null && controller.lon !== null ? (
              <Row label="Koordinat">
                <span className="tabular-nums">
                  {controller.lat.toFixed(5)}, {controller.lon.toFixed(5)}
                </span>
              </Row>
            ) : (
              <Row label="Koordinat">belum diisi</Row>
            )}
            <Row label="Kamera">{controller.cameras.length ? controller.cameras.join(', ') : '-'}</Row>
          </dl>
          <div>
            <p className="mb-1 text-sm font-medium">Sensor ({controller.sensors.length})</p>
            {controller.sensors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada sensor pada perangkat ini.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {controller.sensors.map((s) => (
                  <li key={s.sens_id}>
                    <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onSelect({ kind: 'sensor', id: s.sens_id })}>
                      <Radio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {s.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : sensor ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Radio className="h-5 w-5" aria-hidden="true" />
              Sensor {sensor.name}
            </h3>
            {close}
          </div>
          <dl className="space-y-1 text-sm">
            <Row label="ID sensor">{sensor.sens_id}</Row>
            {sensor.type && <Row label="Jenis">{sensor.type}</Row>}
            <Row label="Perangkat">
              <button type="button" className="min-h-11 underline underline-offset-2" onClick={() => onSelect({ kind: 'controller', id: sensor.dev_id })}>
                {sensor.dev_name}
              </button>
            </Row>
            {sensor.location && <Row label="Lokasi">{sensor.location}</Row>}
          </dl>
          <div>
            <p className="mb-1 text-sm font-medium">Parameter terbaca</p>
            {sensor.params.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada parameter yang terhubung ke petak ini.</p>
            ) : (
              <ul className="space-y-2">
                {sensor.params.map((p) => (
                  <li key={p.ds_id} className="rounded border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="tabular-nums">{p.value === null ? 'belum ada data' : formatNumber(p.value)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{p.read_at ? `Dibaca ${formatDateTime(p.read_at)}` : 'Belum pernah dibaca'}</span>
                      <StateBadge state={paramState(p)} />
                    </div>
                    {(p.warn_min !== null || p.warn_max !== null) && (
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        Batas peringatan: {p.warn_min !== null ? formatNumber(p.warn_min) : '-'} sampai {p.warn_max !== null ? formatNumber(p.warn_max) : '-'}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Klik sensor (silinder ungu) atau perangkat (tiang biru) pada model 3D, atau pilih dari daftar ini.</p>
          <ul className="flex flex-wrap gap-2">
            {controllers.map((c) => (
              <li key={c.dev_id}>
                <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onSelect({ kind: 'controller', id: c.dev_id })}>
                  <Cpu className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {c.name}
                </Button>
              </li>
            ))}
            {sensors.map((s) => (
              <li key={s.sens_id}>
                <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onSelect({ kind: 'sensor', id: s.sens_id })}>
                  <Radio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {s.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
