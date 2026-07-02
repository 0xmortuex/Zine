import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const HISTORY_CAP = 50

/**
 * Library state, persisted under 'zine-library'.
 * Favorites keep a manga snapshot so the library tab renders instantly
 * without refetching.
 */
export const useLibrary = create(
  persist(
    (set, get) => ({
      favorites: {}, // mangaId -> { manga, addedAt }
      progress: {}, // mangaId -> { chapterId, chapterLabel, page, totalPages, updatedAt }
      readChapters: {}, // mangaId -> { chapterId: true }
      history: [], // [{ mangaId, title, coverThumbUrl, chapterId, chapterLabel, at }]

      isFavorite: (mangaId) => Boolean(get().favorites[mangaId]),

      toggleFavorite: (manga) =>
        set((state) => {
          const favorites = { ...state.favorites }
          if (favorites[manga.id]) delete favorites[manga.id]
          else favorites[manga.id] = { manga, addedAt: Date.now() }
          return { favorites }
        }),

      setProgress: (mangaId, progress) =>
        set((state) => ({
          progress: {
            ...state.progress,
            [mangaId]: { ...progress, updatedAt: Date.now() },
          },
        })),

      removeProgress: (mangaId) =>
        set((state) => {
          const progress = { ...state.progress }
          delete progress[mangaId]
          return { progress }
        }),

      markRead: (mangaId, chapterId, read = true) =>
        set((state) => {
          const forManga = { ...(state.readChapters[mangaId] ?? {}) }
          if (read) forManga[chapterId] = true
          else delete forManga[chapterId]
          return { readChapters: { ...state.readChapters, [mangaId]: forManga } }
        }),

      pushHistory: (entry) =>
        set((state) => ({
          history: [
            { ...entry, at: Date.now() },
            ...state.history.filter((h) => h.mangaId !== entry.mangaId),
          ].slice(0, HISTORY_CAP),
        })),

      clearHistory: () => set({ history: [] }),
      clearProgress: () => set({ progress: {}, readChapters: {} }),
      clearFavorites: () => set({ favorites: {} }),
    }),
    { name: 'zine-library' },
  ),
)
