'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const uploadSchema = z.object({
  site_id: z.string().min(1, 'Site wajib dipilih'),
  cluster_id: z.string().optional(),
  media_type: z.string().default('image'),
  media_desc: z.string().optional(),
})

type UploadFormData = z.infer<typeof uploadSchema>

const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

interface UploadMediaDialogProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  sites: any[]
  clusters: any[]
}

export function UploadMediaDialog({ isOpen, onClose, tenantId, sites, clusters }: UploadMediaDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      media_type: 'image',
    },
  })

  const selectedSiteId = watch('site_id')

  // Object URL preview, revoked on change/unmount
  useEffect(() => {
    if (!selectedFile) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Jenis file tidak didukung. Pilih foto PNG, JPG, GIF, atau WebP.')
      return
    }
    if (file.size > MAX_SIZE) {
      setFileError('Ukuran file terlalu besar. Maksimum 10 MB.')
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0])
    e.target.value = ''
  }

  const removeFile = () => {
    setSelectedFile(null)
    setFileError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    acceptFile(e.dataTransfer.files?.[0])
  }

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      setFileError('Pilih foto yang akan diunggah.')
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('site_id', data.site_id)
      if (data.cluster_id) formData.append('cluster_id', data.cluster_id)
      formData.append('media_type', data.media_type)
      if (data.media_desc) formData.append('media_desc', data.media_desc)

      await api.post(`/tenants/${tenantId}/media`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100))
        },
      })

      toast.success('Media berhasil diunggah')

      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['device-media'] })
      queryClient.invalidateQueries({ queryKey: ['monitoring-media'] })

      reset()
      removeFile()
      onClose()
    } catch (error: any) {
      const message = error.response?.data?.message
      const text = Array.isArray(message) ? message.join(', ') : message || 'Gagal mengunggah media'
      setFileError(text)
      toast.error(text)
    } finally {
      setIsUploading(false)
    }
  }

  const filteredClusters = clusters.filter((cluster: any) => cluster.site_id === selectedSiteId)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Unggah Media</DialogTitle>
          <DialogDescription>Unggah foto untuk dokumentasi site Anda</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Foto (PNG, JPG, GIF, WebP)</Label>
            {!preview ? (
              <label
                htmlFor="file-upload"
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false)
                }}
                onDrop={handleDrop}
                className={cn(
                  'block cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
                  isDragging && 'border-primary bg-primary/10',
                  fileError && 'border-destructive'
                )}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="sr-only"
                  id="file-upload"
                />
                <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {isDragging ? 'Lepaskan file di sini' : 'Klik untuk memilih atau seret dan lepas file'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF, WebP hingga 10 MB</p>
              </label>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt={`Pratinjau ${selectedFile?.name ?? 'foto'}`}
                  className="h-64 w-full rounded-lg object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 h-11 w-11"
                  onClick={removeFile}
                  aria-label="Hapus file"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-black/70 px-3 py-1 text-xs text-white">
                  {selectedFile?.name}
                </div>
              </div>
            )}
            <div aria-live="polite" className="min-h-[1rem]">
              {fileError && <p className="text-sm text-destructive">{fileError}</p>}
            </div>
          </div>

          {/* Site Selection */}
          <div className="space-y-2">
            <Label htmlFor="site_id">Site *</Label>
            <Select
              value={watch('site_id') ?? ''}
              onValueChange={(value) => {
                setValue('site_id', value, { shouldValidate: true })
                setValue('cluster_id', '') // Reset cluster when site changes
              }}
            >
              <SelectTrigger id="site_id" className={cn(errors.site_id && 'border-destructive')} aria-invalid={!!errors.site_id}>
                <SelectValue placeholder="Pilih site" />
              </SelectTrigger>
              <SelectContent>
                {sites?.map((site: any) => (
                  <SelectItem key={site.site_id} value={site.site_id}>
                    {site.site_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div aria-live="polite">
              {errors.site_id && <p className="text-sm text-destructive">{errors.site_id.message}</p>}
            </div>
          </div>

          {/* Cluster Selection */}
          <div className="space-y-2">
            <Label htmlFor="cluster_id">Cluster (Opsional)</Label>
            <Select
              value={watch('cluster_id') ?? ''}
              onValueChange={(value) => setValue('cluster_id', value)}
              disabled={!selectedSiteId || filteredClusters.length === 0}
            >
              <SelectTrigger id="cluster_id">
                <SelectValue placeholder="Pilih cluster" />
              </SelectTrigger>
              <SelectContent>
                {filteredClusters?.map((cluster: any) => (
                  <SelectItem key={cluster.cluster_id} value={cluster.cluster_id}>
                    {cluster.cluster_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="media_desc">Deskripsi (Opsional)</Label>
            <Textarea
              id="media_desc"
              placeholder="Masukkan deskripsi media..."
              {...register('media_desc')}
              rows={3}
            />
          </div>

          {isUploading && (
            <div className="space-y-1" role="status">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Progres unggah"
              >
                <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">Mengunggah... {progress}%</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
              Batal
            </Button>
            <Button type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Mengunggah...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  Unggah
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
