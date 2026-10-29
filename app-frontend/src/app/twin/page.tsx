'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CloudSun, Loader2, Play, Sprout } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Label } from '@/components/ui/label'
import { PageTitle } from '@/components/ui/page-title'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { canRunSimulation } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { formatDateTime, formatNumber } from '@/lib/format'
import { addDays, bwdAt, daysBetween, phaseOnDay, sliderRange, valueAtAge, webglSupported, sensorScene, type PlantTwin, type SceneSelection, type SitePlant, type TwinMapData } from '@/lib/twin'
import type { ColorMode } from '@/components/twin/plot-map'
import { TimeSlider } from '@/components/twin/time-slider'
import { GrowthPanel, NutrientPanel, YieldPanel } from '@/components/twin/panels'
import { GroundTruth } from '@/components/twin/ground-truth'
import { TwinStage } from '@/components/twin/twin-stage'

// Leaflet needs the browser (window): never render it on the server
const PlotMap = dynamic(() => import('@/components/twin/plot-map').then((m) => m.PlotMap), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full rounded-lg bg-muted motion-safe:animate-pulse" role="status" aria-label="Memuat peta" />,
})

export default function TwinPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const selectedTenantId = useAuthStore((state) => state.selectedTenantId)
  const activeTenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canRun = canRunSimulation(user)

  const [plantId, setPlantId] = useState<string | null>(null)
  const [day, setDay] = useState<string>('')
  const [mode, setMode] = useState<ColorMode>('visual')
  const [follow, setFollow] = useState(true)
  const [mediaId, setMediaId] = useState<string | null>(null)
  const [picked, setPicked] = useState<SceneSelection | null>(null)
  const [view, setView] = useState<'3d' | '2d'>('3d')
  const [gl, setGl] = useState<boolean | null>(null)

  useEffect(() => {
    setGl(webglSupported())
  }, [])

  const sitePlants = useQuery({
    queryKey: queryKeys.twin(activeTenantId),
    queryFn: async () => (await api.get('/twin')).data as SitePlant[],
    enabled: !!activeTenantId,
  })

  const mapQuery = useQuery({
    queryKey: queryKeys.twinMap(activeTenantId),
    queryFn: async () => (await api.get('/twin/map')).data as TwinMapData,
    enabled: !!activeTenantId,
  })

  // default to the first active plant once the list arrives
  useEffect(() => {
    if (!plantId && sitePlants.data?.length) setPlantId(sitePlants.data[0].plant_id)
  }, [plantId, sitePlants.data])

  const twinQuery = useQuery({
    queryKey: queryKeys.plantTwin(plantId),
    queryFn: async () => (await api.get(`/plants/${plantId}/twin`)).data as PlantTwin,
    enabled: !!plantId,
  })
  const twin = twinQuery.data

  // each plant starts at today
  useEffect(() => {
    if (twin) setDay((prev) => (prev && twin.plant.plant_id === plantId && prev !== '' ? prev : twin.now.date))
  }, [twin, plantId])

  const selectPlant = (id: string) => {
    setPlantId(id)
    setDay('')
    setMediaId(null)
    setPicked(null)
    setFollow(true)
  }

  const simulate = useMutation({
    // skenario cuaca (KERING/BASAH) disembunyikan: data iklim normal belum tersedia
    mutationFn: async () => (await api.post(`/plants/${plantId}/simulate`, { scenario: 'BASE' })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twin'] })
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Simulasi selesai')
    },
    onError: (error: any) => toast.error(apiErrorMessage(error, 'Gagal menjalankan simulasi')),
  })

  const range = useMemo(() => (twin ? sliderRange(twin) : null), [twin])
  const timeline = twin?.simulation?.timeline ?? []
  const clamp = useCallback((d: string) => (range ? (d < range.start ? range.start : d > range.end ? range.end : d) : d), [range])
  const shownDay = twin ? clamp(day || twin.now.date) : ''

  const age = twin?.plant.plant_date && shownDay ? daysBetween(twin.plant.plant_date, shownDay) : null
  const phaseAtDay = twin && shownDay ? phaseOnDay(timeline, shownDay) : undefined
  const bwd = twin && shownDay ? bwdAt(twin.observations, shownDay) : null
  const show3d = view === '3d' && gl === true
  const heightNow = twin && age !== null ? valueAtAge(twin, 'height', age) ?? 0 : 0
  const tillerNow = twin && age !== null ? valueAtAge(twin, 'tiller', age) ?? 1 : 1
  const clusterId = twin ? sitePlants.data?.find((p) => p.plant_id === twin.plant.plant_id)?.cluster_id : undefined
  const scene = useMemo(() => sensorScene(mapQuery.data, clusterId, twin?.sensors ?? []), [mapQuery.data, clusterId, twin])
  const markers = useMemo(() => (twin?.media ?? []).map((m) => (m.date ?? '').slice(0, 10)).filter(Boolean), [twin])

  const onSelectMedia = (id: string) => {
    const m = twin?.media.find((x) => x.media_id === id)
    setMediaId(id)
    setFollow(false)
    if (m?.date) setDay(m.date.slice(0, 10))
  }

  if (sitePlants.isError) {
    return (
      <DashboardLayout>
        <ErrorState onRetry={() => sitePlants.refetch()} />
      </DashboardLayout>
    )
  }

  const empty = sitePlants.isSuccess && sitePlants.data.length === 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <PageTitle>Digital Twin</PageTitle>
            <p className="mt-1 text-muted-foreground">Kondisi petak padi, aktual dan proyeksi sampai panen</p>
          </div>
          {canRun && plantId && (
            <div className="flex flex-wrap items-end gap-2">
              <Button onClick={() => simulate.mutate()} disabled={simulate.isPending}>
                {simulate.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Jalankan simulasi
              </Button>
            </div>
          )}
        </div>

        {sitePlants.isLoading && (
          <div className="h-64 w-full rounded-lg bg-muted motion-safe:animate-pulse" role="status" aria-label="Memuat tanaman" />
        )}

        {empty && (
          <Card className="border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Sprout className="mb-4 h-16 w-16 text-muted-foreground opacity-50" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Belum ada tanaman aktif</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan tanaman terlebih dahulu agar digital twin dapat ditampilkan.</p>
              <Button asChild className="mt-4">
                <Link href="/plants">Buka Tanaman</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {sitePlants.data && sitePlants.data.length > 0 && (
          <Card className="border-2">
            <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="twin-plant">Petak</Label>
                <Select value={plantId ?? undefined} onValueChange={selectPlant}>
                  <SelectTrigger id="twin-plant">
                    <SelectValue placeholder="Pilih petak" />
                  </SelectTrigger>
                  <SelectContent>
                    {sitePlants.data.map((p) => (
                      <SelectItem key={p.plant_id} value={p.plant_id}>
                        {p.name ?? p.plant_id}
                        {p.phase ? ` · ${p.phase.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label id="twin-mode-label">Mode warna</Label>
                <div className="flex gap-1" role="group" aria-labelledby="twin-mode-label">
                  <Button type="button" variant={mode === 'visual' ? 'default' : 'outline'} aria-pressed={mode === 'visual'} onClick={() => setMode('visual')}>
                    Visual
                  </Button>
                  <Button type="button" variant={mode === 'nitrogen' ? 'default' : 'outline'} aria-pressed={mode === 'nitrogen'} onClick={() => setMode('nitrogen')}>
                    Status N
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {twinQuery.isError && <ErrorState onRetry={() => twinQuery.refetch()} />}
        {twinQuery.isLoading && plantId && (
          <div className="h-96 w-full rounded-lg bg-muted motion-safe:animate-pulse" role="status" aria-label="Memuat data twin" />
        )}

        {twin && range && shownDay && (
          <>
            <Card className="border-2">
              <CardHeader className="bg-muted/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{twin.plant.name ?? twin.plant.plant_id}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {twin.variety && <Badge variant="outline">{twin.variety.name}</Badge>}
                    {twin.plant.season && <Badge variant="outline">{twin.plant.season}</Badge>}
                    {twin.plant.area_ha != null && <Badge variant="outline">{formatNumber(twin.plant.area_ha)} ha</Badge>}
                    {twin.now.phase && (
                      <Badge variant="secondary" className="gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: twin.now.phase.color ?? undefined }} aria-hidden="true" />
                        {twin.now.phase.name}
                        {twin.now.age !== null && <span className="tabular-nums">· HST {twin.now.age}</span>}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {!twin.simulation && (
                  <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                    Belum ada simulasi untuk petak ini, jadi fase di bawah memakai data tanaman saja.{' '}
                    {canRun ? 'Klik "Jalankan simulasi" untuk menghitung proyeksi.' : 'Minta admin atau agronom menjalankan simulasi.'}
                  </p>
                )}
                {twin.simulation?.note && <p className="text-sm text-muted-foreground">Catatan model: {twin.simulation.note}</p>}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1" role="group" aria-label="Tampilan petak">
                    <Button type="button" size="sm" variant={view === '3d' ? 'default' : 'outline'} aria-pressed={view === '3d'} onClick={() => setView('3d')}>
                      3D
                    </Button>
                    <Button type="button" size="sm" variant={view === '2d' ? 'default' : 'outline'} aria-pressed={view === '2d'} onClick={() => setView('2d')}>
                      Peta
                    </Button>
                  </div>
                  {view === '3d' && gl === false && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Browser ini tidak mendukung WebGL, jadi model 3D diganti peta.
                    </p>
                  )}
                </div>

                {show3d ? (
                  <TwinStage
                    twin={twin}
                    shownDay={shownDay}
                    age={age}
                    phaseAtDay={phaseAtDay}
                    bwd={bwd}
                    heightNow={heightNow}
                    tillerNow={tillerNow}
                    mode={mode}
                    scene={scene}
                    mediaId={mediaId}
                    picked={picked}
                    onPick={setPicked}
                    onSelectMedia={onSelectMedia}
                  />
                ) : (
                  <PlotMap
                    plants={sitePlants.data ?? []}
                    mapData={mapQuery.data}
                    parameters={twin.sensors}
                    selectedId={twin.plant.plant_id}
                    mode={mode}
                    phaseColor={phaseAtDay?.color ?? twin.now.phase?.color ?? null}
                    bwd={bwd}
                    bwdMin={twin.reference.bwd_min}
                    media={twin.media}
                    selectedMediaId={mediaId}
                    onSelectPlant={selectPlant}
                    onSelectMedia={onSelectMedia}
                  />
                )}

                <TimeSlider
                  start={range.start}
                  end={range.end}
                  today={twin.now.date}
                  plantDate={twin.plant.plant_date}
                  value={shownDay}
                  onChange={setDay}
                  timeline={timeline}
                  markers={markers}
                  followTimeline={follow}
                  onFollowChange={setFollow}
                />
                {shownDay > addDays(twin.now.date, 0) && (
                  <p className="text-sm text-muted-foreground">
                    Tanggal setelah hari ini adalah proyeksi model. Observasi dan BWD yang tampil adalah yang terakhir tercatat.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GrowthPanel twin={twin} age={age} />
              <NutrientPanel twin={twin} />
              <YieldPanel twin={twin} />
              <GroundTruth twin={twin} day={shownDay} follow={follow} selectedMediaId={mediaId} onSelect={onSelectMedia} />
            </div>

            <Card className="border-2">
              <CardHeader className="bg-muted/50">
                <CardTitle className="flex items-center gap-2">
                  <CloudSun className="h-5 w-5" aria-hidden="true" />
                  Cuaca
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-sm">
                {twin.weather.latest ? (
                  <p className="tabular-nums">
                    Terakhir ({formatDateTime(twin.weather.latest.date, 'dd MMM')}): {twin.weather.latest.tmin ?? '-'}-{twin.weather.latest.tmax ?? '-'} °C
                    {twin.weather.latest.rain != null && `, hujan ${twin.weather.latest.rain} mm`}
                    {twin.weather.latest.rh != null && `, RH ${twin.weather.latest.rh}%`}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Belum ada data cuaca aktual untuk site ini.</p>
                )}
                {twin.weather.forecast.length > 0 && (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {twin.weather.forecast.map((f) => (
                      <li key={f.date} className="rounded border p-2 text-center tabular-nums">
                        <div className="text-xs text-muted-foreground">{formatDateTime(f.date, 'dd MMM')}</div>
                        <div>
                          {f.tmin ?? '-'}-{f.tmax ?? '-'}°
                        </div>
                        {f.rain != null && <div className="text-xs">{f.rain} mm</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
