import { create } from 'zustand'
import { Shift } from '../types'
import { shiftsApi, api } from '../api/client'

interface ShiftStore {
  shifts: Shift[]
  activeShift: Shift | null
  loading: boolean
  listPlanned: () => Promise<void>
  openShift: (id: string) => Promise<void>
  closeShift: (id: string) => Promise<void>
  loadActive: () => Promise<void>
}

export const useShiftStore = create<ShiftStore>((set, get) => ({
  shifts: [],
  activeShift: null,
  loading: false,

  listPlanned: async () => {
    set({ loading: true })
    try {
      const data = await api.get('/shifts').then((r) => r.data)
      set({ shifts: data })
    } finally {
      set({ loading: false })
    }
  },

  openShift: async (id: string) => {
    await shiftsApi.open(id)
    await get().listPlanned()
    await get().loadActive()
  },

  closeShift: async (id: string) => {
    await shiftsApi.close(id)
    await get().listPlanned()
    set({ activeShift: null })
  },

  loadActive: async () => {
    try {
      const shift = await shiftsApi.active()
      set({ activeShift: shift })
    } catch {
      set({ activeShift: null })
    }
  },
}))
