import { create } from 'zustand'

let nextId = 1

/** Ephemeral toast queue (not persisted). */
export const useToasts = create((set) => ({
  toasts: [],

  push: (message, { kind = 'info', duration = 3200 } = {}) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (message, opts) => useToasts.getState().push(message, opts)
