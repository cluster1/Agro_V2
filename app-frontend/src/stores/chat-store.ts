import { create } from 'zustand'

interface ChatState {
  open: boolean
  /** petak yang sedang dilihat pengguna (diisi halaman Digital Twin), supaya "petak ini" bisa dijawab */
  plantId: string | null
  setOpen: (open: boolean) => void
  setPlantId: (plantId: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  plantId: null,
  setOpen: (open) => set({ open }),
  setPlantId: (plantId) => set({ plantId }),
}))
