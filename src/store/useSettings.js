import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_THEME } from '../lib/themes'

/**
 * User preferences, persisted to localStorage under 'zine-settings'.
 * The custom background IMAGE lives in IndexedDB (lib/backgroundStore.js);
 * only its display metadata is kept here.
 */
export const useSettings = create(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,

      // 'auto' detects from pointer type + viewport; 'mobile'/'desktop' force.
      layout: 'auto',

      background: {
        enabled: false,
        blur: 12, // px, 0–24
        dim: 0.5, // 0–0.9 overlay opacity
        fit: 'cover', // 'cover' | 'contain'
      },

      reader: {
        mode: 'paged', // 'paged' | 'vertical'
        fit: 'height', // 'width' | 'height' | 'original'
        direction: 'rtl', // 'rtl' (manga) | 'ltr'
        dataSaver: false,
        preloadCount: 3,
        autoplayInterval: 8, // seconds per page, 1–60
        autoScrollSpeed: 120, // px/sec in vertical mode, 40–400
        tapToPause: true,
      },

      languages: ['en'],
      contentRatings: ['safe', 'suggestive'],

      // Optional CORS proxy base URL for the MangaDex API (see
      // cors-proxy/worker.js). Empty = direct + public-relay fallback.
      apiProxy: '',

      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setBackground: (patch) =>
        set((state) => ({ background: { ...state.background, ...patch } })),
      setReader: (patch) => set((state) => ({ reader: { ...state.reader, ...patch } })),
      setLanguages: (languages) => set({ languages }),
      setContentRatings: (contentRatings) => set({ contentRatings }),
      setApiProxy: (apiProxy) => set({ apiProxy }),
    }),
    { name: 'zine-settings' },
  ),
)
