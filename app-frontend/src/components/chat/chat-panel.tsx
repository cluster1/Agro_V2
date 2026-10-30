'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle, RotateCcw, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import { canRunSimulation } from '@/lib/permissions'
import { queryKeys } from '@/lib/query-keys'
import { symptomLabel } from '@/lib/observation'
import { N_STATUS, nStatus, nitrogenCheckHint, type PlantTwin, type SitePlant } from '@/lib/twin'
import type { FarmDashboard } from '@/lib/farm-reports'
import { buildReply, neededData, type AlertItem, type AnswerContext, type Reply, type ReplyAction, type ScheduleItem } from '@/lib/chatbot/answers'
import { extractDays, matchIntent, matchPlant } from '@/lib/chatbot/intents'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  paragraphs: string[]
  suggestions?: Reply['suggestions']
  action?: ReplyAction
  /** keadaan kartu konfirmasi simulasi */
  actionState?: 'pending' | 'running' | 'done' | 'cancelled'
}

const STALE = 30_000

/** yyyy-MM-dd untuk n hari lalu; alert belum ditangani dicari sampai 90 hari ke belakang (bawaan API hanya 7 hari). */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
const MAX_INPUT = 300

/**
 * Agro Asisten, asisten data petak tanpa LLM: pertanyaan dicocokkan ke maksud (lib/chatbot), data diambil dari endpoint yang
 * sudah menyaring tenant dan role, dan jawaban dirangkai dari data itu. Simulasi hanya jalan setelah konfirmasi.
 */
export function ChatPanel() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const selectedTenantId = useAuthStore((s) => s.selectedTenantId)
  const open = useChatStore((s) => s.open)
  const setOpen = useChatStore((s) => s.setOpen)
  const storePlantId = useChatStore((s) => s.plantId)
  const tenantId = user?.user_level === 0 && selectedTenantId ? selectedTenantId : user?.tenant_id
  const canSimulate = canRunSimulation(user)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const lastPlant = useRef<string | null>(null)
  const nextId = useRef(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  const push = useCallback((m: Omit<ChatMessage, 'id'>) => {
    const id = nextId.current++
    setMessages((prev) => [...prev, { ...m, id }])
    return id
  }, [])

  const reset = useCallback(() => {
    lastPlant.current = null
    const greeting = buildReply({ kind: 'intent', intent: 'greeting', score: 1, term: null }, emptyContext())
    nextId.current = 1
    setMessages([{ id: nextId.current++, role: 'assistant', paragraphs: greeting.paragraphs, suggestions: greeting.suggestions }])
  }, [])

  // sapaan awal saat pertama dibuka
  useEffect(() => {
    if (open && messages.length === 0) reset()
  }, [open, messages.length, reset])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  const close = useCallback(() => {
    setOpen(false)
    openerRef.current?.focus()
  }, [setOpen])

  const fetchPlants = () =>
    queryClient.fetchQuery({ queryKey: queryKeys.twin(tenantId), queryFn: async () => (await api.get('/twin')).data as SitePlant[], staleTime: STALE })

  const fetchTwin = (plantId: string, fresh = false) =>
    queryClient.fetchQuery({ queryKey: queryKeys.plantTwin(plantId), queryFn: async () => (await api.get(`/plants/${plantId}/twin`)).data as PlantTwin, staleTime: fresh ? 0 : STALE })

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, MAX_INPUT)
    if (!text || busy) return
    push({ role: 'user', paragraphs: [text] })
    setInput('')
    setBusy(true)
    try {
      const match = matchIntent(text)
      const plants = (await fetchPlants().catch(() => [] as SitePlant[])).map((p) => ({ plant_id: p.plant_id, name: p.name }))
      const named = matchPlant(text, plants)
      if (named) lastPlant.current = named
      const plantId = named ?? lastPlant.current ?? storePlantId ?? (plants.length === 1 ? plants[0].plant_id : null)
      const needs = match.kind === 'intent' ? neededData(match.intent) : []

      const [twin, farm, alerts, schedules] = await Promise.all([
        needs.includes('twin') && plantId ? fetchTwin(plantId) : Promise.resolve(null),
        needs.includes('farm')
          ? queryClient.fetchQuery({ queryKey: queryKeys.farmDashboard(tenantId), queryFn: async () => (await api.get('/reports/farm-dashboard')).data as FarmDashboard, staleTime: STALE })
          : Promise.resolve(null),
        needs.includes('alerts')
          ? queryClient.fetchQuery({ queryKey: ['alerts', 'chat', tenantId], queryFn: async () => (await api.get('/alerts', { params: { status: 0, startDate: daysAgo(90), endDate: daysAgo(0) } })).data as AlertItem[], staleTime: STALE })
          : Promise.resolve([] as AlertItem[]),
        needs.includes('schedules')
          ? queryClient.fetchQuery({ queryKey: [...queryKeys.schedules(tenantId), 'chat'], queryFn: async () => (await api.get('/schedules')).data as ScheduleItem[], staleTime: STALE })
          : Promise.resolve([] as ScheduleItem[]),
      ])

      if (twin) lastPlant.current = twin.plant.plant_id
      const reply = buildReply(match, {
        today: new Date().toISOString().slice(0, 10),
        plants,
        twin,
        farm,
        alerts,
        schedules,
        nitrogenLabel: twin ? N_STATUS[nStatus(twin.nutrients.bwd, twin.reference.bwd_min)].label : null,
        hint: twin ? nitrogenCheckHint(twin) : null,
        days: extractDays(text),
        schedulePlantId: named,
        canSimulate,
        symptomLabel,
      })
      push({ role: 'assistant', paragraphs: reply.paragraphs, suggestions: reply.suggestions, action: reply.action, actionState: reply.action ? 'pending' : undefined })
    } catch (error) {
      push({ role: 'assistant', paragraphs: [apiErrorMessage(error, 'Maaf, data tidak bisa dimuat. Coba lagi sebentar lagi.')] })
    } finally {
      setBusy(false)
    }
  }

  const setState = (id: number, actionState: ChatMessage['actionState']) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, actionState } : m)))

  const runSimulation = async (id: number, action: ReplyAction) => {
    setState(id, 'running')
    try {
      await api.post(`/plants/${action.plantId}/simulate`, { scenario: 'BASE' })
      // sama dengan tombol di halaman twin: segarkan data twin dan jadwal
      await queryClient.invalidateQueries({ queryKey: ['twin'] })
      await queryClient.invalidateQueries({ queryKey: ['schedules'] })
      setState(id, 'done')
      const twin = await fetchTwin(action.plantId, true)
      const reply = buildReply({ kind: 'intent', intent: 'yield', score: 1, term: null }, { ...emptyContext(), twin, canSimulate })
      push({ role: 'assistant', paragraphs: ['Perkiraan selesai dihitung.', ...reply.paragraphs], suggestions: reply.suggestions })
    } catch (error) {
      setState(id, 'pending')
      push({ role: 'assistant', paragraphs: [apiErrorMessage(error, 'Gagal menghitung perkiraan.')] })
    }
  }

  return (
    <>
      <Button
        ref={openerRef}
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-drawer h-12 w-12 rounded-full shadow-lg coarse:h-12 coarse:w-12"
        aria-label={open ? 'Tutup Agro Asisten' : 'Buka Agro Asisten'}
        aria-expanded={open}
        aria-controls="chat-panel"
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
      </Button>

      {open && (
        <section
          id="chat-panel"
          role="dialog"
          aria-label="Agro Asisten"
          className="fixed bottom-20 right-4 z-drawer flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
        >
          <header className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Agro Asisten</h2>
              <p className="text-xs text-muted-foreground">Menjawab dari data aplikasi</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label="Obrolan baru" disabled={busy} onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Tutup" onClick={close}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>

          <div role="log" aria-live="polite" aria-label="Percakapan" className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[88%] space-y-2 rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {m.paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line break-words">
                      {p}
                    </p>
                  ))}

                  {m.action && (
                    <div className="space-y-2 border-t pt-2">
                      {m.actionState === 'done' ? (
                        <p className="text-xs text-muted-foreground">Sudah dijalankan.</p>
                      ) : m.actionState === 'cancelled' ? (
                        <p className="text-xs text-muted-foreground">Dibatalkan.</p>
                      ) : (
                        <div className="flex gap-2">
                          <Button type="button" size="sm" disabled={m.actionState === 'running'} onClick={() => runSimulation(m.id, m.action as ReplyAction)}>
                            {m.actionState === 'running' && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                            Jalankan
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={m.actionState === 'running'} onClick={() => setState(m.id, 'cancelled')}>
                            Batal
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.suggestions.map((s) => (
                        <Button key={s.text} type="button" size="sm" variant="outline" className="h-auto min-h-9 whitespace-normal rounded-full px-3 py-1 text-left text-xs" disabled={busy} onClick={() => send(s.text)}>
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start" role="status">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Mengambil data...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={MAX_INPUT} placeholder="Tanya data petak..." aria-label="Pertanyaan" disabled={busy} autoComplete="off" />
            <Button type="submit" size="icon" aria-label="Kirim" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </section>
      )}
    </>
  )
}

/** Konteks kosong untuk jawaban yang tidak membutuhkan data (salam, bantuan). */
function emptyContext(): AnswerContext {
  return {
    today: new Date().toISOString().slice(0, 10),
    plants: [],
    twin: null,
    farm: null,
    alerts: [],
    schedules: [],
    nitrogenLabel: null,
    hint: null,
    days: 7,
    schedulePlantId: null,
    canSimulate: false,
    symptomLabel,
  }
}
