'use client'

import { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import { uploadUrl } from '@/lib/utils'
import { bwdAt, compareTruth, phaseOnDay, type PlantTwin, type TwinMedia } from '@/lib/twin'

type Filter = 'all' | 'cctv' | 'photo'

const isCctv = (m: TwinMedia) => /cctv|snapshot/i.test(m.type ?? '')
const dayOfMedia = (m: TwinMedia) => (m.date ? m.date.slice(0, 10) : '')

interface GroundTruthProps {
  twin: PlantTwin
  /** tanggal slider */
  day: string
  follow: boolean
  selectedMediaId: string | null
  onSelect: (mediaId: string) => void
}

/** Gambar terpilih + filter + strip thumbnail + perbandingan Model vs Petugas pada tanggal gambar. */
export function GroundTruth({ twin, day, follow, selectedMediaId, onSelect }: GroundTruthProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [broken, setBroken] = useState<Set<string>>(new Set())

  const items = useMemo(
    () =>
      twin.media
        .filter((m) => m.path && (filter === 'all' || (filter === 'cctv' ? isCctv(m) : !isCctv(m))))
        .sort((a, b) => dayOfMedia(a).localeCompare(dayOfMedia(b))),
    [twin.media, filter],
  )

  // "Ikuti timeline": snapshot on the slider date, or the latest one before it (after today: the last one)
  const followed = useMemo(() => {
    const upTo = items.filter((m) => dayOfMedia(m) <= day)
    return upTo.length ? upTo[upTo.length - 1] : items[0]
  }, [items, day])

  const selected = (follow ? followed : items.find((m) => m.media_id === selectedMediaId)) ?? followed
  const mediaDay = selected ? dayOfMedia(selected) : null
  const projected = !!selected && follow && dayOfMedia(selected) < day && day > twin.now.date

  const modelPhase = mediaDay && twin.simulation ? phaseOnDay(twin.simulation.timeline, mediaDay) : undefined
  const observation = mediaDay ? twin.observations.find((o) => o.date === mediaDay) : undefined
  const verdict = compareTruth(observation, modelPhase, mediaDay ? bwdAt(twin.observations, mediaDay) : null)

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'cctv', label: 'CCTV' },
    { value: 'photo', label: 'Foto' },
  ]

  return (
    <Card className="border-2">
      <CardHeader className="bg-muted/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Gambar lapangan</CardTitle>
          <div className="flex gap-1" role="group" aria-label="Filter gambar">
            {filters.map((f) => (
              <Button key={f.value} type="button" size="sm" variant={filter === f.value ? 'default' : 'outline'} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ImageOff className="mb-3 h-10 w-10 text-muted-foreground opacity-60" aria-hidden="true" />
            <p className="font-medium">Belum ada gambar</p>
            <p className="mt-1 text-sm text-muted-foreground">Foto kegiatan dan observasi petak ini akan tampil di sini.</p>
          </div>
        ) : (
          <>
            {selected && (
              <figure className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border bg-muted">
                  {broken.has(selected.media_id) ? (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Gambar tidak dapat dimuat</div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadUrl(selected.path as string)}
                      alt={selected.description ?? `Gambar petak ${twin.plant.name ?? ''} tanggal ${mediaDay}`}
                      className="max-h-80 w-full object-contain"
                      loading="lazy"
                      onError={() => setBroken((prev) => new Set(prev).add(selected.media_id))}
                    />
                  )}
                  {projected && (
                    <Badge variant="warning" className="absolute left-2 top-2">
                      Proyeksi: gambar terakhir
                    </Badge>
                  )}
                </div>
                <figcaption className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
                  <span>{mediaDay ? formatDateTime(mediaDay, 'dd MMM yyyy') : '-'}</span>
                  {selected.age !== null && <span>· HST {selected.age}</span>}
                  <Badge variant="outline">{isCctv(selected) ? 'CCTV' : 'Foto'}</Badge>
                  {selected.description && <span className="truncate">· {selected.description}</span>}
                </figcaption>
              </figure>
            )}

            <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Daftar gambar">
              {items.map((m) => {
                const active = m.media_id === selected?.media_id
                return (
                  <li key={m.media_id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelect(m.media_id)}
                      aria-pressed={active}
                      aria-label={`Gambar ${dayOfMedia(m)}${m.description ? `, ${m.description}` : ''}`}
                      className={`relative h-16 w-20 overflow-hidden rounded border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'border-primary' : 'border-transparent'}`}
                    >
                      {broken.has(m.media_id) ? (
                        <span className="flex h-full items-center justify-center bg-muted text-xs">?</span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={uploadUrl(m.path as string)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={() => setBroken((prev) => new Set(prev).add(m.media_id))}
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="overflow-hidden rounded-md border text-sm">
              <table className="w-full">
                <caption className="sr-only">Perbandingan model dan petugas pada tanggal gambar</caption>
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Sumber</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Fase / BWD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">Model</th>
                    <td className="px-3 py-2">{verdict.model}</td>
                  </tr>
                  <tr className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">Petugas</th>
                    <td className="px-3 py-2">{verdict.officer}</td>
                  </tr>
                  <tr className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">Status</th>
                    <td className="px-3 py-2">
                      {verdict.status === 'NONE' ? (
                        <span className="text-muted-foreground">Belum ada observasi pada tanggal ini</span>
                      ) : (
                        <Badge variant={verdict.status === 'MATCH' ? 'success' : 'destructive'}>{verdict.status === 'MATCH' ? 'Sesuai' : 'Selisih'}</Badge>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Sesuai bila fase sama atau selisih BWD ≤ 0,3.{' '}
              <Link href="/observations" className="underline underline-offset-2">
                Buka observasi untuk memverifikasi
              </Link>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
