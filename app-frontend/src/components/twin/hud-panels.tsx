'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Cpu, Radio } from 'lucide-react'
import { formatDateTime, formatNumber } from '@/lib/format'
import { N_STATUS, paramState, type NitrogenCheckHint, type DeviceSummary, type PlantTwin, type SceneSelection, type SensorParam } from '@/lib/twin'

/** Panel kecukupan hara di atas model: status N (warna daun pada tanggal slider) dan kekurangan N, P, K dari model. */
export function NutrientHud({ status, bwd, bwdMin, nutrients, hint }: { status: keyof typeof N_STATUS; bwd: number | null; bwdMin: number | null; nutrients: PlantTwin['nutrients']; hint: NitrogenCheckHint }) {
  const [open, setOpen] = useState(true)
  const meta = N_STATUS[status]
  const rows = [
    { label: 'N', value: nutrients.n_def, unit: 'kg N/ha' },
    { label: 'P', value: nutrients.p2o5_def, unit: 'kg/ha' },
    { label: 'K', value: nutrients.k2o_def, unit: 'kg/ha' },
  ]
  return (
    <div className="rounded-md border bg-background/90 text-[11px] shadow backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="twin-hud-nutrient"
        className="flex min-h-9 w-full items-center justify-between gap-2 px-2.5 py-1 font-medium"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ backgroundColor: meta.color }} aria-hidden="true" />
          Kecukupan hara · nitrogen {meta.label.toLowerCase()}
        </span>
        {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <div id="twin-hud-nutrient" className="space-y-1 border-t px-2.5 py-1.5">
          <p className="tabular-nums text-muted-foreground">
            Warna daun: skala {bwd !== null ? String(bwd).replace('.', ',') : '-'}
            {bwdMin !== null ? ` · minimal tahap ini: ${bwdMin}` : ' · tahap ini tanpa batas warna daun'}
          </p>
          {hint.shortMessages.map((m) => (
            <p key={m} role="status" className="flex items-start gap-1 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              {m}
            </p>
          ))}
          <ul aria-label="Kekurangan hara menurut sistem" className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3">
                <span className="font-medium">{r.label}</span>
                {r.value === null ? (
                  <span className="text-muted-foreground">belum dihitung</span>
                ) : r.value > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-destructive">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    kurang {formatNumber(r.value)} {r.unit}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    cukup
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ParamRow({ p }: { p: SensorParam }) {
  const st = paramState(p)
  const bad = st === 'low' || st === 'high'
  const title = `${p.name}: ${p.value === null ? 'belum ada data' : formatNumber(p.value)}${p.read_at ? ` · diukur ${formatDateTime(p.read_at)}` : ''}`
  return (
    <li className="flex items-center justify-between gap-2" title={title}>
      <span className="truncate text-muted-foreground">{p.name}</span>
      <span className={`inline-flex shrink-0 items-center gap-1 font-medium tabular-nums ${bad ? 'text-destructive' : ''}`}>
        {bad && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
        {p.value === null ? '-' : formatNumber(p.value)}
        {bad && <span className="sr-only">{st === 'low' ? 'di bawah batas peringatan' : 'di atas batas peringatan'}</span>}
      </span>
    </li>
  )
}

/** Kotak HUD terpisah: judul yang dapat diklik untuk menyorot objek di 3D, dan tombol lipat sendiri. */
function HudBox({
  id,
  icon,
  title,
  meta,
  selected,
  onSelect,
  children,
}: {
  id: string
  icon: React.ReactNode
  title: string
  meta?: string
  selected?: boolean
  onSelect?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const head = (
    <>
      {icon}
      <span className="truncate font-medium">{title}</span>
      {meta && <span className="shrink-0 text-muted-foreground">· {meta}</span>}
    </>
  )
  return (
    <section aria-label={title} className={`shrink-0 rounded-md border bg-background/90 text-[11px] shadow backdrop-blur-sm ${selected ? 'border-2 border-amber-500' : ''}`}>
      <div className="flex items-stretch">
        {onSelect ? (
          <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1 text-left">
            {head}
          </button>
        ) : (
          <div className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1">{head}</div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${open ? 'Lipat' : 'Buka'} ${title}`}
          className="flex min-h-9 w-9 shrink-0 items-center justify-center"
        >
          {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id={id} className="space-y-0.5 border-t px-2.5 py-1.5">
          {children}
        </div>
      )}
    </section>
  )
}

/** Kotak HUD per perangkat dan per sensor di atas model, juga untuk yang belum punya koordinat. */
export function DeviceHud({ devices, selected, onSelect }: { devices: DeviceSummary[]; selected: SceneSelection | null; onSelect: (s: SceneSelection) => void }) {
  const isSel = (kind: SceneSelection['kind'], id: string) => selected?.kind === kind && selected.id === id
  if (devices.length === 0) {
    return (
      <HudBox id="twin-hud-empty" icon={<Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />} title="Perangkat & sensor">
        <p className="text-muted-foreground">Belum ada perangkat di kelompok petak ini.</p>
      </HudBox>
    )
  }
  return (
    <>
      {devices.map(({ controller: c, sensors, loose }) => (
        <div key={c.dev_id} className="contents">
          <HudBox
            id={`twin-hud-dev-${c.dev_id}`}
            icon={<Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            title={c.name}
            meta={c.status === 1 ? 'Aktif' : c.status === null ? undefined : 'Nonaktif'}
            selected={isSel('controller', c.dev_id)}
            onSelect={() => onSelect({ kind: 'controller', id: c.dev_id })}
          >
            <p className="text-muted-foreground">{sensors.length} sensor terhubung</p>
            {c.cameras.length > 0 && <p className="text-muted-foreground">Kamera: {c.cameras.join(', ')}</p>}
          </HudBox>
          {sensors.map((s) => (
            <HudBox
              key={s.sens_id}
              id={`twin-hud-sens-${s.sens_id}`}
              icon={<Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              title={s.name}
              meta={s.type ?? undefined}
              selected={isSel('sensor', s.sens_id)}
              onSelect={() => onSelect({ kind: 'sensor', id: s.sens_id })}
            >
              {s.params.length === 0 ? (
                <p className="text-muted-foreground">belum ada parameter terhubung</p>
              ) : (
                <ul className="space-y-0.5" aria-label={`Parameter ${s.name}`}>
                  {s.params.map((p) => (
                    <ParamRow key={p.ds_id} p={p} />
                  ))}
                </ul>
              )}
            </HudBox>
          ))}
          {loose.length > 0 && (
            <HudBox id={`twin-hud-loose-${c.dev_id}`} icon={<Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />} title={`Parameter lain · ${c.name}`}>
              <ul className="space-y-0.5" aria-label={`Parameter lain ${c.name}`}>
                {loose.map((p) => (
                  <ParamRow key={p.ds_id} p={p} />
                ))}
              </ul>
            </HudBox>
          )}
        </div>
      ))}
    </>
  )
}
