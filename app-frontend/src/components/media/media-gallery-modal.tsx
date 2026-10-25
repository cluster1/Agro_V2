'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Calendar, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { uploadUrl } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { MediaImage } from '@/components/media/media-image'

interface MediaItem {
  media_id: string
  media_path: string
  media_desc?: string
  media_date: string
  media_type: string
}

interface MediaGalleryModalProps {
  media: MediaItem[]
  isOpen: boolean
  onClose: () => void
  initialIndex?: number
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

function extensionFor(path: string, blobType: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(path)
  if (match) return match[1].toLowerCase()
  return MIME_EXT[blobType] ?? 'jpg'
}

export function MediaGalleryModal({ media, isOpen, onClose, initialIndex = 0 }: MediaGalleryModalProps) {
  const total = media?.length ?? 0
  const [index, setIndex] = useState(initialIndex)

  // Re-sync whenever the gallery opens or the requested start changes.
  useEffect(() => {
    if (isOpen) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialIndex])

  const goPrev = useCallback(() => {
    if (total > 0) setIndex((i) => (i - 1 + total) % total)
  }, [total])
  const goNext = useCallback(() => {
    if (total > 0) setIndex((i) => (i + 1) % total)
  }, [total])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goPrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goNext()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setIndex(Math.max(total - 1, 0))
    }
  }

  if (!media || total === 0) return null

  const current = Math.min(index, total - 1)
  const selectedMedia = media[current]
  // media_path dari backend sudah dalam format: uploads/filename.jpg
  const imageUrl = uploadUrl(selectedMedia.media_path ?? '')
  const altText = selectedMedia.media_desc || `Foto ${formatDateTime(selectedMedia.media_date)}`

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `media-${selectedMedia.media_id}.${extensionFor(selectedMedia.media_path, blob.type)}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('Gagal mengunduh file. Silakan coba lagi.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0" onKeyDown={handleKeyDown}>
        <DialogTitle className="sr-only">Galeri media</DialogTitle>
        <DialogDescription className="sr-only">
          Gunakan tombol panah kiri dan kanan untuk berpindah foto. Tekan Escape untuk menutup.
        </DialogDescription>
        <div className="flex h-full flex-col bg-black text-white">
          {/* Header (right padding leaves room for the dialog's own close button) */}
          <div className="flex items-center justify-between gap-2 bg-black/50 p-2 pr-14 backdrop-blur-sm">
            <p className="px-2 text-sm tabular-nums" aria-live="polite">
              {current + 1} / {total}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-white hover:bg-white/10 hover:text-white"
              onClick={handleDownload}
              aria-label="Unduh"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Image */}
          <div className="relative flex min-h-[40vh] flex-1 items-center justify-center overflow-hidden p-6">
            {total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                onClick={goPrev}
                aria-label="Sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
            )}
            <MediaImage
              key={selectedMedia.media_id}
              src={imageUrl}
              alt={altText}
              eager
              width={1200}
              height={800}
              className="h-auto max-h-[60vh] w-auto max-w-full object-contain"
              fallbackClassName="min-h-[40vh] bg-black text-white/80"
            />
            {total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                onClick={goNext}
                aria-label="Berikutnya"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Info Footer */}
          <div className="bg-black/50 p-4 backdrop-blur-sm">
            {selectedMedia.media_desc && (
              <div className="mb-2 flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm">{selectedMedia.media_desc}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>{formatDateTime(selectedMedia.media_date, 'EEEE, dd MMMM yyyy HH:mm')}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
