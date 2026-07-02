import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { useEffect } from 'react'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import MangaPage from './pages/MangaPage'
import ReaderPage from './pages/ReaderPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import { useSettings } from './store/useSettings'
import { applyTheme } from './lib/themes'

export default function App() {
  const location = useLocation()
  const theme = useSettings((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const isReader = location.pathname.startsWith('/read/')

  return (
    <MotionConfig reducedMotion="user">
      {isReader ? (
        // Immersive reader: no app chrome, fade-through transitions.
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/read/:mangaId/:chapterId" element={<ReaderPage />} />
          </Routes>
        </AnimatePresence>
      ) : (
        <Layout>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/manga/:id" element={<MangaPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AnimatePresence>
        </Layout>
      )}
    </MotionConfig>
  )
}
