'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { buildBody, initialValue, type FieldDef, type ResourceDef } from '@/lib/master-data'
import { guardedOpenChange } from '@/components/forms/form-utils'

const NONE = 'none'
const ID_RE = /^[A-Z0-9][A-Z0-9_-]*$/

const ENUM_LABELS: Record<string, string> = { '1': 'Aktif / Ya', '0': 'Nonaktif / Tidak' }

function RefSelect({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const ref = field.ref!
  const query = useQuery({
    queryKey: queryKeys.ref(ref.resource, ...(ref.params ? Object.values(ref.params) : [])),
    queryFn: async () => (await api.get(`/ref/${ref.resource}`, { params: ref.params })).data as Record<string, any>[],
    staleTime: 5 * 60 * 1000,
  })
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled || query.isLoading}>
      <SelectTrigger id={`md-${field.key}`} aria-required={field.required}>
        <SelectValue placeholder={query.isLoading ? 'Memuat...' : 'Pilih'} />
      </SelectTrigger>
      <SelectContent>
        {!field.required && <SelectItem value={NONE}>Tidak diisi</SelectItem>}
        {query.data?.map((o) => (
          <SelectItem key={o[ref.value]} value={o[ref.value]}>
            {o[ref.label] ?? o[ref.value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface MasterDataFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  def: ResourceDef
  row: Record<string, unknown> | null
  mode: 'create' | 'edit'
}

export function MasterDataFormDialog({ open, onOpenChange, def, row, mode }: MasterDataFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'
  const [id, setId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    setId('')
    setErrors({})
    setDirty(false)
    setValues(Object.fromEntries(def.fields.map((f) => [f.key, initialValue(f, editing ? row : null)])))
  }, [open, editing, row, def])

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
    setDirty(true)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = buildBody(def, values, editing)
      if (editing) return (await api.patch(`/ref/${def.resource}/${row![def.idKey]}`, body)).data
      return (await api.post(`/ref/${def.resource}`, def.manualId ? { id, ...body } : body)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ref'] })
      toast.success(editing ? 'Data diperbarui' : 'Data ditambahkan')
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast.error(apiErrorMessage(error, editing ? 'Gagal memperbarui data' : 'Gagal menambahkan data'))
    },
  })

  const submit = () => {
    const next: Record<string, string> = {}
    if (!editing && def.manualId) {
      if (!id) next.__id = 'Kode wajib diisi'
      else if (!ID_RE.test(id)) next.__id = "Gunakan huruf besar, angka, '-' atau '_'"
      else if (id.length > (def.idMax ?? 32)) next.__id = `Maksimal ${def.idMax ?? 32} karakter`
    }
    for (const f of def.fields) {
      if (editing && f.createOnly) continue
      const v = (values[f.key] ?? '').trim()
      if (f.required && !v) next[f.key] = `${f.label} wajib diisi`
      else if ((f.kind === 'number' || f.kind === 'int') && v && !Number.isFinite(Number(v.replace(',', '.')))) {
        next[f.key] = 'Harus berupa angka'
      } else if (f.kind === 'int' && v && !Number.isInteger(Number(v))) next[f.key] = 'Harus bilangan bulat'
    }
    setErrors(next)
    if (Object.keys(next).length === 0) mutation.mutate()
  }

  const handleOpenChange = guardedOpenChange(onOpenChange, { isDirty: dirty, isBusy: mutation.isPending })
  const star = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {editing ? 'Edit' : 'Tambah'} {def.label}
          </DialogTitle>
          <DialogDescription>
            Master data berlaku untuk semua tenant. {def.note ?? 'Perubahan dicatat pada log audit.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {def.manualId && (
              <div className="space-y-2">
                <Label htmlFor="md-id">Kode{!editing && star}</Label>
                <Input
                  id="md-id"
                  value={editing ? String(row?.[def.idKey] ?? '') : id}
                  onChange={(e) => {
                    setId(e.target.value.toUpperCase())
                    setErrors((p) => ({ ...p, __id: '' }))
                    setDirty(true)
                  }}
                  disabled={editing}
                  placeholder={def.idHint}
                  autoComplete="off"
                  aria-invalid={!!errors.__id}
                  aria-describedby={errors.__id ? 'md-id-error' : undefined}
                />
                {errors.__id && (
                  <p id="md-id-error" role="alert" className="text-sm font-medium text-destructive">
                    {errors.__id}
                  </p>
                )}
              </div>
            )}

            {def.fields.map((f) => {
              const locked = editing && f.createOnly
              const err = errors[f.key]
              return (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={`md-${f.key}`}>
                    {f.label}
                    {f.required && !locked && star}
                  </Label>
                  {f.kind === 'enum' ? (
                    <Select value={values[f.key] || NONE} onValueChange={(v) => set(f.key, v === NONE ? '' : v)}>
                      <SelectTrigger id={`md-${f.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Tidak diisi</SelectItem>
                        {f.options!.map((o) => (
                          <SelectItem key={o} value={o}>
                            {ENUM_LABELS[o] && (f.key.endsWith('_sts') || f.key === 'actype_need_photo')
                              ? f.key === 'actype_need_photo'
                                ? o === '1' ? 'Ya' : 'Tidak'
                                : o === '1' ? 'Aktif' : 'Nonaktif'
                              : o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.kind === 'ref' ? (
                    <RefSelect field={f} value={values[f.key] ?? ''} onChange={(v) => set(f.key, v)} disabled={locked} />
                  ) : (
                    <Input
                      id={`md-${f.key}`}
                      type="text"
                      inputMode={f.kind === 'text' ? undefined : 'decimal'}
                      value={values[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      autoComplete="off"
                      aria-required={f.required}
                      aria-invalid={!!err}
                      aria-describedby={err ? `md-${f.key}-error` : undefined}
                    />
                  )}
                  {f.hint && !err && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                  {err && (
                    <p id={`md-${f.key}-error`} role="alert" className="text-sm font-medium text-destructive">
                      {err}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              )}
              {editing ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
