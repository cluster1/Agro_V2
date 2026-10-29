'use client'

import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { N_STATUS, deviceSummaries, nStatus, type PlantTwin, type SceneSelection, type TimelineEntry, type sensorScene } from '@/lib/twin'
import type { ColorMode } from '@/components/twin/plot-map'
import type { Plot3DApi } from '@/components/twin/plot-3d'
import { DeviceHud, NutrientHud } from '@/components/twin/hud-panels'
import { PlotCard, StageKpis, StageToolbar } from '@/components/twin/stage-overlays'

// three.js is heavy and needs the browser: load it only when the 3D view is shown
const Plot3D = dynamic(() => import('@/components/twin/plot-3d'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[360px] w-full bg-muted motion-safe:animate-pulse" role="status" aria-label="Memuat model 3D" />,
})

interface TwinStageProps {
  twin: PlantTwin
  shownDay: string
  age: number | null
  phaseAtDay: TimelineEntry | undefined
  bwd: number | null
  heightNow: number
  tillerNow: number
  mode: ColorMode
  scene: ReturnType<typeof sensorScene>
  mediaId: string | null
  picked: SceneSelection | null
  onPick: (selection: SceneSelection | null) => void
  onSelectMedia: (id: string) => void
}

/**
 * Tampilan 3D penuh dengan panel mengambang: ringkasan di kiri atas, kolom petak/hara/perangkat di kanan,
 * dan toolbar kamera. Di bawah lebar lg panel ditumpuk di bawah kanvas.
 */
export function TwinStage({ twin, shownDay, age, phaseAtDay, bwd, heightNow, tillerNow, mode, scene, mediaId, picked, onPick, onSelectMedia }: TwinStageProps) {
  const api = useRef<Plot3DApi | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const devices = useMemo(() => deviceSummaries(scene.controllers, twin.sensors), [scene.controllers, twin.sensors])
  const bwdMin = twin.reference.bwd_min
  const status = nStatus(bwd, bwdMin)
  const currentSeq = phaseAtDay ? phaseAtDay.seq : twin.now.phase?.seq ?? null
  const isProjection = shownDay > twin.now.date
  const name = twin.plant.name ?? twin.plant.plant_id

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border lg:h-[70vh] lg:min-h-[480px]">
        <div className="h-[55vh] min-h-[360px] lg:absolute lg:inset-0 lg:h-auto">
          <Plot3D
            heightCm={heightNow}
            tillers={tillerNow}
            bwd={bwd}
            bwdMin={bwdMin}
            mode={mode}
            phaseSeq={currentSeq}
            geom={twin.plant.geom}
            media={twin.media}
            selectedMediaId={mediaId}
            controllers={scene.controllers}
            sensors={scene.sensors}
            showLabels={showLabels}
            api={api}
            selected={picked}
            onSelectDevice={onPick}
            onSelectMedia={onSelectMedia}
            label={`Model 3D petak ${name}, tinggi ${Math.round(heightNow)} sentimeter`}
          />
        </div>

        <div className="space-y-3 p-3 lg:pointer-events-none lg:absolute lg:inset-0 lg:space-y-0 lg:p-0">
          <div className="lg:pointer-events-auto lg:absolute lg:left-3 lg:right-[23.5rem] lg:top-3">
            <StageKpis twin={twin} age={age} phase={phaseAtDay} bwd={bwd} isProjection={isProjection} />
          </div>

          <div className="lg:pointer-events-auto lg:absolute lg:right-[19.5rem] lg:top-3">
            <StageToolbar api={api} showLabels={showLabels} onToggleLabels={() => setShowLabels((v) => !v)} hasSensors={scene.sensors.length > 0} />
          </div>

          <div className="flex flex-col gap-2 lg:pointer-events-auto lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:w-72 lg:overflow-y-auto">
            <PlotCard twin={twin} />
            <NutrientHud status={status} bwd={bwd} bwdMin={bwdMin} nutrients={twin.nutrients} />
            <DeviceHud devices={devices} selected={picked} onSelect={onPick} />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        Cuplikan 6 × 6 m, jajar legowo 2:1; bukan skala petak. Geser untuk memutar, gulir atau tombol zoom untuk memperbesar. Tinggi {Math.round(heightNow)} cm, {Math.round(tillerNow)} anakan per rumpun.
        {` Status N ${N_STATUS[status].label.toLowerCase()}.`}
      </figcaption>
    </figure>
  )
}
