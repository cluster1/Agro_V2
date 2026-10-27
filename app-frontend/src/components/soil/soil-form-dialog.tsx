'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { DRAINAGE, DRAINAGE_LABEL, LAND_CLASSES, LAND_CLASS_LABEL, P_METHODS, textureError } from '@/lib/soil'
import { guardedOpenChange, num, numDisplay, optionalNumber } from '@/components/forms/form-utils'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/api-error'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const todayISO = () => format(new Date(), 'yyyy-MM-dd')
const UNSET = 'none'

const NUMERIC = [
  'soil_depth_top',
  'soil_depth_bottom',
  'soil_sand',
  'soil_silt',
  'soil_clay',
  'soil_ph_h2o',
  'soil_ph_kcl',
  'soil_c_org',
  'soil_n_total',
  'soil_p_avail',
  'soil_k_exch',
  'soil_ca_exch',
  'soil_mg_exch',
  'soil_cec',
  'soil_base_sat',
  'soil_ec',
  'soil_bulk_density',
  'soil_fc',
  'soil_wp',
] as const

type NumericKey = (typeof NUMERIC)[number]

const schema = z
  .object({
    cluster_id: z.string().min(1, 'Petak harus dipilih'),
    soil_sample_date: z.string().regex(DAY_RE, 'Tanggal sampling wajib diisi'),
    soil_sample_code: z.string().max(64, 'Maksimal 64 karakter').optional(),
    soil_lab: z.string().max(128, 'Maksimal 128 karakter').optional(),
    soil_type: z.string().max(64, 'Maksimal 64 karakter').optional(),
    soil_texture: z.string().max(32, 'Maksimal 32 karakter').optional(),
    soil_depth_top: optionalNumber(),
    soil_depth_bottom: optionalNumber(),
    soil_sand: optionalNumber(),
    soil_silt: optionalNumber(),
    soil_clay: optionalNumber(),
    soil_ph_h2o: optionalNumber(),
    soil_ph_kcl: optionalNumber(),
    soil_c_org: optionalNumber(),
    soil_n_total: optionalNumber(),
    soil_p_avail: optionalNumber(),
    soil_p_method: z.string().optional(),
    soil_k_exch: optionalNumber(),
    soil_ca_exch: optionalNumber(),
    soil_mg_exch: optionalNumber(),
    soil_cec: optionalNumber(),
    soil_base_sat: optionalNumber(),
    soil_ec: optionalNumber(),
    soil_bulk_density: optionalNumber(),
    soil_fc: optionalNumber(),
    soil_wp: optionalNumber(),
    soil_drainage: z.string().optional(),
    soil_land_class: z.string().optional(),
    soil_doc: z.string().max(255, 'Maksimal 255 karakter').optional(),
    soil_desc: z.string().max(255, 'Maksimal 255 karakter').optional(),
  })
  .superRefine((v, ctx) => {
    const texture = textureError(num(v.soil_sand), num(v.soil_silt), num(v.soil_clay))
    if (texture) ctx.addIssue({ code: 'custom', path: ['soil_clay'], message: texture })
    const ph = (value: unknown, path: string) => {
      const n = num(value)
      if (n !== undefined && (n < 3 || n > 10)) ctx.addIssue({ code: 'custom', path: [path], message: 'pH harus 3-10' })
    }
    ph(v.soil_ph_h2o, 'soil_ph_h2o')
    ph(v.soil_ph_kcl, 'soil_ph_kcl')
    const fc = num(v.soil_fc)
    const wp = num(v.soil_wp)
    if (fc !== undefined && wp !== undefined && fc <= wp) {
      ctx.addIssue({ code: 'custom', path: ['soil_fc'], message: 'Harus lebih besar dari titik layu' })
    }
    const top = num(v.soil_depth_top)
    const bottom = num(v.soil_depth_bottom)
    if (top !== undefined && bottom !== undefined && bottom <= top) {
      ctx.addIssue({ code: 'custom', path: ['soil_depth_bottom'], message: 'Harus lebih dalam dari kedalaman atas' })
    }
    if (num(v.soil_p_avail) !== undefined && (!v.soil_p_method || v.soil_p_method === UNSET)) {
      ctx.addIssue({ code: 'custom', path: ['soil_p_method'], message: 'Metode wajib diisi bila P tersedia diisi' })
    }
  })

type FormValues = z.infer<typeof schema>

interface SoilFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  profile?: any
  mode: 'create' | 'edit'
}

const emptyValues = (): FormValues => ({
  cluster_id: '',
  soil_sample_date: todayISO(),
  soil_sample_code: '',
  soil_lab: '',
  soil_type: '',
  soil_texture: '',
  ...(Object.fromEntries(NUMERIC.map((k) => [k, undefined])) as Record<NumericKey, undefined>),
  soil_p_method: UNSET,
  soil_drainage: UNSET,
  soil_land_class: UNSET,
  soil_doc: '',
  soil_desc: '',
})

const NUMBER_FIELDS: Record<NumericKey, { label: string; hint?: string }> = {
  soil_depth_top: { label: 'Kedalaman atas (cm)' },
  soil_depth_bottom: { label: 'Kedalaman bawah (cm)' },
  soil_sand: { label: 'Pasir (%)' },
  soil_silt: { label: 'Debu (%)' },
  soil_clay: { label: 'Liat (%)', hint: 'Pasir + debu + liat = 100% ±1' },
  soil_ph_h2o: { label: 'pH H₂O', hint: '3-10' },
  soil_ph_kcl: { label: 'pH KCl', hint: '3-10' },
  soil_c_org: { label: 'C-organik (%)' },
  soil_n_total: { label: 'N total (%)' },
  soil_p_avail: { label: 'P tersedia (mg/kg)' },
  soil_k_exch: { label: 'K dapat tukar (cmol/kg)' },
  soil_ca_exch: { label: 'Ca dapat tukar (cmol/kg)' },
  soil_mg_exch: { label: 'Mg dapat tukar (cmol/kg)' },
  soil_cec: { label: 'KTK (cmol/kg)' },
  soil_base_sat: { label: 'Kejenuhan basa (%)' },
  soil_ec: { label: 'EC (dS/m)' },
  soil_bulk_density: { label: 'Bulk density (g/cm³)' },
  soil_fc: { label: 'Kapasitas lapang (%)' },
  soil_wp: { label: 'Titik layu (%)' },
}

const GROUPS: { title: string; keys: NumericKey[] }[] = [
  { title: 'Kedalaman sampel', keys: ['soil_depth_top', 'soil_depth_bottom'] },
  { title: 'Tekstur', keys: ['soil_sand', 'soil_silt', 'soil_clay'] },
  { title: 'Kemasaman dan bahan organik', keys: ['soil_ph_h2o', 'soil_ph_kcl', 'soil_c_org', 'soil_n_total'] },
  { title: 'Hara dan kapasitas tukar', keys: ['soil_p_avail', 'soil_k_exch', 'soil_ca_exch', 'soil_mg_exch', 'soil_cec', 'soil_base_sat'] },
  { title: 'Sifat fisik', keys: ['soil_ec', 'soil_bulk_density', 'soil_fc', 'soil_wp'] },
]

export function SoilFormDialog({ open, onOpenChange, tenantId, profile, mode }: SoilFormDialogProps) {
  const queryClient = useQueryClient()
  const editing = mode === 'edit'
  const form = useForm<FormValues>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: emptyValues() })

  const clustersQuery = useQuery({
    queryKey: queryKeys.clusters(tenantId),
    queryFn: async () => (await api.get('/clusters')).data,
    enabled: !!tenantId && open,
  })

  useEffect(() => {
    if (!open) return
    if (editing && profile) {
      const base = emptyValues() as Record<string, unknown>
      for (const key of Object.keys(base)) {
        const value = profile[key]
        if (value !== null && value !== undefined) base[key] = key === 'soil_sample_date' ? String(value).slice(0, 10) : value
      }
      form.reset(base as FormValues)
    } else {
      form.reset(emptyValues())
    }
  }, [open, editing, profile, form])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['soil-profiles'] })

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const body: Record<string, unknown> = {
        soil_sample_date: v.soil_sample_date,
        ...Object.fromEntries(
          (['soil_sample_code', 'soil_lab', 'soil_type', 'soil_texture', 'soil_doc', 'soil_desc'] as const)
            .filter((k) => v[k])
            .map((k) => [k, v[k]]),
        ),
        ...Object.fromEntries(NUMERIC.filter((k) => num(v[k]) !== undefined).map((k) => [k, num(v[k])])),
        ...Object.fromEntries(
          (['soil_p_method', 'soil_drainage', 'soil_land_class'] as const)
            .filter((k) => v[k] && v[k] !== UNSET)
            .map((k) => [k, v[k]]),
        ),
      }
      return editing
        ? (await api.patch(`/soil-profiles/${profile.soil_id}`, body)).data
        : (await api.post('/soil-profiles', { ...body, cluster_id: v.cluster_id })).data
    },
    onSuccess: () => {
      invalidate()
      toast.success(editing ? 'Profil tanah diperbarui' : 'Profil tanah dicatat')
      onOpenChange(false)
    },
    onError: (error: any) => {
      applyApiFieldErrors(error, form.setError)
      toast.error(apiErrorMessage(error, editing ? 'Gagal memperbarui profil tanah' : 'Gagal mencatat profil tanah'))
    },
  })

  const handleOpenChange = guardedOpenChange(onOpenChange, { isDirty: form.formState.isDirty, isBusy: mutation.isPending })
  const required = (
    <>
      <span aria-hidden="true"> *</span>
      <span className="sr-only"> (wajib diisi)</span>
    </>
  )

  const numberField = (name: NumericKey) => (
    <FormField
      key={name}
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{NUMBER_FIELDS[name].label}</FormLabel>
          <FormControl>
            <Input type="number" inputMode="decimal" step="any" {...field} value={numDisplay(field.value)} />
          </FormControl>
          {NUMBER_FIELDS[name].hint && <FormDescription>{NUMBER_FIELDS[name].hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const optionSelect = (
    name: 'soil_p_method' | 'soil_drainage' | 'soil_land_class',
    label: string,
    options: { value: string; label: string }[],
    req = false,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || UNSET}>
            <FormControl>
              <SelectTrigger aria-required={req}>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={UNSET}>Tidak diisi</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {editing ? 'Edit Profil Tanah' : 'Tambah Profil Tanah'}
          </DialogTitle>
          <DialogDescription>
            Hasil uji laboratorium per petak. Status hara P dan K diturunkan otomatis dari P tersedia dan K dapat tukar.
          </DialogDescription>
        </DialogHeader>

        {clustersQuery.isError ? (
          <ErrorState title="Gagal memuat daftar petak" onRetry={() => clustersQuery.refetch()} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cluster_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Petak{required}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={editing || clustersQuery.isLoading}>
                        <FormControl>
                          <SelectTrigger aria-required="true">
                            <SelectValue placeholder={clustersQuery.isLoading ? 'Memuat petak...' : 'Pilih petak'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {editing && profile && (
                            <SelectItem value={profile.cluster_id}>{profile.cluster_name ?? profile.cluster_id}</SelectItem>
                          )}
                          {clustersQuery.data?.map((c: any) => (
                            <SelectItem key={c.cluster_id} value={c.cluster_id}>
                              {c.cluster_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="soil_sample_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal sampling{required}</FormLabel>
                      <FormControl>
                        <Input type="date" max={todayISO()} aria-required="true" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(
                  [
                    ['soil_sample_code', 'Kode sampel', 'SPL-A-2608'],
                    ['soil_lab', 'Laboratorium', 'Nama laboratorium'],
                    ['soil_type', 'Jenis tanah', 'Mis. Inceptisol'],
                    ['soil_texture', 'Kelas tekstur', 'Mis. Lempung berliat'],
                  ] as const
                ).map(([name, label, placeholder]) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input placeholder={placeholder} autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {GROUPS.map((group) => (
                <fieldset key={group.title} className="space-y-3 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">{group.title}</legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.keys.map(numberField)}
                    {group.title === 'Hara dan kapasitas tukar' &&
                      optionSelect('soil_p_method', 'Metode P tersedia', P_METHODS.map((m) => ({ value: m, label: m })), true)}
                  </div>
                </fieldset>
              ))}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {optionSelect(
                  'soil_drainage',
                  'Drainase',
                  DRAINAGE.map((d) => ({ value: d, label: DRAINAGE_LABEL[d] })),
                )}
                {optionSelect(
                  'soil_land_class',
                  'Kelas kesesuaian lahan',
                  LAND_CLASSES.map((c) => ({ value: c, label: LAND_CLASS_LABEL[c] })),
                )}
              </div>

              <FormField
                control={form.control}
                name="soil_doc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rujukan laporan lab</FormLabel>
                    <FormControl>
                      <Input placeholder="Nomor laporan atau tautan" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>Unggah berkas PDF belum tersedia; isi nomor atau tautan laporan.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="soil_desc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
