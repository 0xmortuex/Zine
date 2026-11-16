import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_THEME, THEMES } from '../lib/themes.js'
import { mergeSettings } from './persistedState.js'
import { guardedPersist } from './guardedPersist.js'

const THEME_IDS = THEMES.map((theme) => theme.id)

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
        autoplayInterval: 8, // base seconds per page, 1–60
        smartTiming: true, // scale autoplay per page by visual density/shape
        autoScrollSpeed: 120, // px/sec in vertical mode, 40–400
        tapToPause: true,
      },

      languages: ['en'],
      contentRatings: ['safe', 'suggestive'],
      // Hide search results whose chapters exist only as external links
      // (publisher-removed titles) — every listed book is readable in-app.
      readableOnly: true,

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
      setReadableOnly: (readableOnly) => set({ readableOnly }),
      setApiProxy: (apiProxy) => set({ apiProxy }),
    }),
    // Saved settings are merged key by key over the defaults (see
    // persistedState.js): a setting added after a visitor last saved gets
    // its default instead of undefined, and an unusable value falls back to
    // its default — announced, never silently.
    guardedPersist(
      'zine-settings',
      'settings',
      (persisted, current) => mergeSettings(persisted, current, THEME_IDS),
      () => useSettings,
    ),
  ),
)
