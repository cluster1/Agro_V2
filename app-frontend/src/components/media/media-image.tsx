'use client'

import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MediaImageProps {
  src: string
  alt: string
  className?: string
  /** Tailwind classes for the fallback box (defaults to filling the parent). */
  fallbackClassName?: string
  width?: number
  height?: number
  eager?: boolean
}

/**
 * <img> with lazy loading, async decoding and a React-state fallback
 * (no DOM mutation) when the file cannot be loaded.
 */
export function MediaImage({ src, alt, className, fallbackClassName, width = 400, height = 300, eager }: MediaImageProps) {
  const [failed, setFailed] = useState(!src)

  useEffect(() => {
    setFailed(!src)
  }, [src])

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (gambar tidak tersedia)`}
        className={cn('flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground', fallbackClassName)}
      >
        <ImageOff className="h-8 w-8" aria-hidden="true" />
        <span className="text-xs">Gambar tidak tersedia</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
