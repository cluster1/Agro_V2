'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pause, Play } from 'lucide-react'
import { cn, uploadUrl } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { MediaImage } from '@/components/media/media-image'

interface MediaItem {
  media_id: string
  media_path: string
  media_desc?: string
  media_date: string
  media_type: string
}

interface MediaCarouselProps {
  media: MediaItem[]
  onViewAll?: (index?: number) => void
  autoRotate?: boolean
  interval?: number
}

const DESKTOP_ITEMS = 4

const arrowClass =
  'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-opacity hover:bg-black/90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:opacity-100 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'

export function MediaCarousel({ media, onViewAll, autoRotate = true, interval = 5000 }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [hoverPaused, setHoverPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Detect screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024) // lg breakpoint
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Respect prefers-reduced-motion (auto-rotation off)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // One shared value for the timer and the render
  const itemsPerView = isMobile ? 1 : DESKTOP_ITEMS
  const maxIndex = Math.max(0, (media?.length ?? 0) - itemsPerView)

  // Keep the index valid when the viewport or data changes
  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex))
  }, [maxIndex])

  const isPlaying = autoRotate && !reducedMotion && !userPaused && !hoverPaused

  useEffect(() => {
    if (!isPlaying || !media || media.length <= itemsPerView) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
    }, interval)
    return () => clearInterval(timer)
  }, [isPlaying, interval, media, itemsPerView, maxIndex])

  if (!media || media.length === 0) {
    return (
      <div className="relative flex h-80 items-center justify-center rounded-lg bg-muted/30">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" aria-hidden="true" />
          <p className="text-sm">Belum ada media</p>
        </div>
      </div>
    )
  }

  const goToPrevious = () => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : maxIndex))
  const goToNext = () => setCurrentIndex((prev) => (prev < maxIndex ? prev + 1 : 0))

  const visibleMedia = media.slice(currentIndex, currentIndex + itemsPerView)
  const canPage = media.length > itemsPerView

  return (
    <div
      className="group relative h-48 overflow-hidden rounded-lg bg-muted/30"
      role="region"
      aria-roledescription="carousel"
      aria-label="Galeri media situs"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverPaused(false)
      }}
    >
      {/* Images Grid */}
      <div className="grid h-full grid-cols-1 gap-2 p-2 lg:grid-cols-4">
        {visibleMedia.map((mediaItem, i) => (
          <button
            type="button"
            key={mediaItem.media_id}
            onClick={() => onViewAll?.(currentIndex + i)}
            className="relative h-full overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Buka foto: ${mediaItem.media_desc || formatDateTime(mediaItem.media_date)}`}
          >
            <MediaImage
              src={uploadUrl(mediaItem.media_path)}
              alt={mediaItem.media_desc || `Foto ${formatDateTime(mediaItem.media_date)}`}
              width={400}
              height={192}
              className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {mediaItem.media_desc && (
              <div className="absolute bottom-2 left-2 right-2">
                <span className="line-clamp-2 rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                  {mediaItem.media_desc}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      {canPage && (
        <>
          <button type="button" onClick={goToPrevious} aria-label="Sebelumnya" className={cn(arrowClass, 'left-2')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={goToNext} aria-label="Berikutnya" className={cn(arrowClass, 'right-2')}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}

      {/* Counter + pause/play */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between p-2">
        <Badge variant="secondary" className="border-0 bg-black/70 text-white tabular-nums backdrop-blur-sm">
          {currentIndex + 1}-{Math.min(currentIndex + itemsPerView, media.length)} / {media.length}
        </Badge>
        {autoRotate && canPage && !reducedMotion && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            aria-label={userPaused ? 'Putar' : 'Jeda'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {userPaused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* Dots */}
      {canPage && (
        <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Halaman ${index + 1}`}
              aria-current={index === currentIndex}
              className="flex h-11 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all',
                  index === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/60 group-focus-within:bg-white/70'
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
