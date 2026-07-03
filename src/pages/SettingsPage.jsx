import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import clsx from 'clsx'
import PageTransition from '../components/PageTransition'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Toggle from '../components/ui/Toggle'
import Slider from '../components/ui/Slider'
import SegmentedControl from '../components/ui/SegmentedControl'
import Select from '../components/ui/Select'
import { THEMES } from '../lib/themes'
import { useSettings } from '../store/useSettings'
import { useLibrary } from '../store/useLibrary'
import { toast } from '../store/useToasts'
import {
  saveBackground,
  loadBackground,
  clearBackground,
  notifyBackgroundChanged,
} from '../lib/backgroundStore'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useLayoutMode } from '../hooks/useLayoutMode'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt-br', label: 'Português (BR)' },
]

const RATINGS = ['safe', 'suggestive', 'erotica']

export default function SettingsPage() {
  return (
    <PageTransition>
      <section className="mb-10">
        <h2 className="text-display mb-1 text-4xl lowercase sm:text-5xl">settings.</h2>
        <p className="text-sm text-muted">The colophon — how your copy of Zine is set.</p>
      </section>

      <div className="max-w-3xl space-y-14">
        <SettingsSection index="01" title="Appearance">
          <ThemePicker />
          <LayoutSettings />
          <BackgroundSettings />
        </SettingsSection>

        <SettingsSection index="02" title="Reader">
          <ReaderSettings />
        </SettingsSection>

        <SettingsSection index="03" title="Content">
          <ContentSettings />
        </SettingsSection>

        <SettingsSection index="04" title="Data">
          <DataSettings />
        </SettingsSection>
      </div>
    </PageTransition>
  )
}

function SettingsSection({ index, title, children }) {
  return (
    <section>
      <div className="mb-6 flex items-baseline gap-3">
        <span className="tnum text-sm font-bold text-accent">{index}</span>
        <h3 className="text-display text-xl lowercase">{title.toLowerCase()}.</h3>
        <div className="rule-h flex-1 self-center" />
      </div>
      <div className="space-y-8 pl-0 sm:pl-8">{children}</div>
    </section>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

/* ------------------------------- Appearance ------------------------------ */

function ThemePicker() {
  const theme = useSettings((s) => s.theme)
  const setTheme = useSettings((s) => s.setTheme)

  return (
    <div>
      <p className="mb-3 text-sm font-medium">Theme</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {THEMES.map((preset) => (
          <motion.button
            key={preset.id}
            whileTap={{ scale: 0.93 }}
            whileHover={{ y: -3 }}
            onClick={() => setTheme(preset.id)}
            className={clsx(
              'focus-ink rounded-lg border p-2 text-left',
              theme === preset.id ? 'border-accent' : 'border-border hover:border-accent/50',
            )}
            aria-pressed={theme === preset.id}
          >
            <span
              className="mb-2 flex h-12 overflow-hidden rounded-md border border-border"
              aria-hidden="true"
            >
              {preset.swatches.map((color, i) => (
                <span key={i} className="flex-1" style={{ backgroundColor: color }} />
              ))}
            </span>
            <span className="flex items-center justify-between text-xs font-semibold">
              {preset.label}
              {theme === preset.id && <Icon name="check" size={13} className="text-accent" />}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function LayoutSettings() {
  const layout = useSettings((s) => s.layout)
  const setLayout = useSettings((s) => s.setLayout)
  const resolved = useLayoutMode()

  return (
    <FieldRow
      label="Interface layout"
      hint={
        layout === 'auto'
          ? `Detected from your device — currently ${resolved === 'mobile' ? 'mobile (bottom navigation)' : 'desktop (header navigation)'}.`
          : 'Forced — switch to Auto to follow the device.'
      }
    >
      <SegmentedControl
        label="Interface layout"
        value={layout}
        onChange={setLayout}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'mobile', label: 'Mobile' },
          { value: 'desktop', label: 'Desktop' },
        ]}
      />
    </FieldRow>
  )
}

function BackgroundSettings() {
  const background = useSettings((s) => s.background)
  const setBackground = useSettings((s) => s.setBackground)
  const fileInput = useRef(null)
  const [storedBlob, setStoredBlob] = useState(null)
  const previewUrl = useObjectUrl(storedBlob)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadBackground().then((blob) => setStoredBlob(blob ?? null))
  }, [])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('That file is not an image.', { kind: 'error' })
      return
    }
    setBusy(true)
    try {
      const blob = await saveBackground(file)
      setStoredBlob(blob)
      setBackground({ enabled: true })
      notifyBackgroundChanged()
      toast('Background set.', { kind: 'success' })
    } catch {
      toast('Could not process that image.', { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    await clearBackground()
    setStoredBlob(null)
    setBackground({ enabled: false })
    notifyBackgroundChanged()
    toast('Background removed.')
  }

  return (
    <div className="space-y-5">
      <FieldRow
        label="Custom background"
        hint="Your own image behind the whole app; panels frost over it."
      >
        <Toggle
          checked={background.enabled && Boolean(storedBlob)}
          onChange={(on) => {
            if (on && !storedBlob) {
              fileInput.current?.click()
              return
            }
            setBackground({ enabled: on })
          }}
          label="Custom background"
        />
      </FieldRow>

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="focus-ink group relative flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent"
        >
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Background preview" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Icon name="upload" size={20} className="text-white" />
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <Icon name="upload" size={18} />
              {busy ? 'Processing…' : 'Upload image'}
            </span>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        {storedBlob && (
          <Button variant="danger" size="sm" onClick={handleRemove}>
            <Icon name="trash" size={14} /> Remove
          </Button>
        )}
      </div>

      {background.enabled && storedBlob && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Slider
            label="Blur"
            value={background.blur}
            onChange={(blur) => setBackground({ blur })}
            min={0}
            max={24}
            format={(v) => `${v}px`}
          />
          <Slider
            label="Dim"
            value={background.dim}
            onChange={(dim) => setBackground({ dim })}
            min={0}
            max={0.9}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <FieldRow label="Fit">
            <SegmentedControl
              label="Background fit"
              value={background.fit}
              onChange={(fit) => setBackground({ fit })}
              options={[
                { value: 'cover', label: 'Fill' },
                { value: 'contain', label: 'Fit' },
              ]}
            />
          </FieldRow>
        </motion.div>
      )}
    </div>
  )
}

/* --------------------------------- Reader -------------------------------- */

function ReaderSettings() {
  const reader = useSettings((s) => s.reader)
  const setReader = useSettings((s) => s.setReader)

  return (
    <div className="space-y-6">
      <FieldRow label="Default mode">
        <SegmentedControl
          label="Reading mode"
          value={reader.mode}
          onChange={(mode) => setReader({ mode })}
          options={[
            { value: 'paged', label: 'Paged' },
            { value: 'vertical', label: 'Vertical' },
          ]}
        />
      </FieldRow>

      <FieldRow label="Page fit" hint="Paged mode only.">
        <SegmentedControl
          label="Page fit"
          value={reader.fit}
          onChange={(fit) => setReader({ fit })}
          options={[
            { value: 'height', label: 'Fit height' },
            { value: 'width', label: 'Fit width' },
            { value: 'original', label: 'Original' },
          ]}
        />
      </FieldRow>

      <FieldRow label="Reading direction" hint="Right-to-left is traditional for manga.">
        <SegmentedControl
          label="Reading direction"
          value={reader.direction}
          onChange={(direction) => setReader({ direction })}
          options={[
            { value: 'rtl', label: 'Right → left' },
            { value: 'ltr', label: 'Left → right' },
          ]}
        />
      </FieldRow>

      <Slider
        label="Autoplay timer"
        value={reader.autoplayInterval}
        onChange={(autoplayInterval) => setReader({ autoplayInterval })}
        min={1}
        max={60}
        format={(v) => `${v}s`}
      />

      <FieldRow
        label="Smart page timing"
        hint="Analyzes each page and scales the timer — dense, tall, or busy pages get more reading time."
      >
        <Toggle
          checked={reader.smartTiming}
          onChange={(smartTiming) => setReader({ smartTiming })}
          label="Smart page timing"
        />
      </FieldRow>

      <Slider
        label="Auto-scroll speed"
        value={reader.autoScrollSpeed}
        onChange={(autoScrollSpeed) => setReader({ autoScrollSpeed })}
        min={40}
        max={400}
        step={10}
        format={(v) => `${v}px/s`}
      />

      <Slider
        label="Preload pages"
        value={reader.preloadCount}
        onChange={(preloadCount) => setReader({ preloadCount })}
        min={1}
        max={8}
      />

      <FieldRow label="Data saver" hint="Compressed pages from MangaDex — slower connections.">
        <Toggle
          checked={reader.dataSaver}
          onChange={(dataSaver) => setReader({ dataSaver })}
          label="Data saver"
        />
      </FieldRow>

      <FieldRow label="Tap to pause autoplay" hint="Tapping the page pauses/resumes the timer.">
        <Toggle
          checked={reader.tapToPause}
          onChange={(tapToPause) => setReader({ tapToPause })}
          label="Tap to pause"
        />
      </FieldRow>
    </div>
  )
}

/* -------------------------------- Content -------------------------------- */

function ContentSettings() {
  const languages = useSettings((s) => s.languages)
  const setLanguages = useSettings((s) => s.setLanguages)
  const contentRatings = useSettings((s) => s.contentRatings)
  const setContentRatings = useSettings((s) => s.setContentRatings)
  const apiProxy = useSettings((s) => s.apiProxy)
  const setApiProxy = useSettings((s) => s.setApiProxy)
  const readableOnly = useSettings((s) => s.readableOnly)
  const setReadableOnly = useSettings((s) => s.setReadableOnly)

  function toggleRating(rating) {
    const next = contentRatings.includes(rating)
      ? contentRatings.filter((r) => r !== rating)
      : [...contentRatings, rating]
    if (next.length === 0) {
      toast('At least one rating must stay on.', { kind: 'error' })
      return
    }
    setContentRatings(next)
  }

  return (
    <div className="space-y-6">
      <FieldRow label="Chapter language" hint="Which translations to list.">
        <Select
          value={languages[0]}
          onChange={(lang) => setLanguages([lang])}
          options={LANGUAGES}
          className="w-44"
        />
      </FieldRow>

      <FieldRow
        label="Readable in-app only"
        hint="Hide titles whose chapters exist only on external official sites — publishers have those removed from MangaDex, so they can't be read here."
      >
        <Toggle
          checked={readableOnly}
          onChange={setReadableOnly}
          label="Readable in-app only"
        />
      </FieldRow>

      <div>
        <p className="mb-1 text-sm font-medium">Content ratings</p>
        <p className="mb-3 text-xs text-muted">Applied to search and chapter feeds.</p>
        <div className="flex gap-2">
          {RATINGS.map((rating) => {
            const on = contentRatings.includes(rating)
            return (
              <motion.button
                key={rating}
                whileTap={{ scale: 0.93 }}
                onClick={() => toggleRating(rating)}
                className={clsx('stamp focus-ink cursor-pointer', on && 'stamp-accent')}
                aria-pressed={on}
              >
                {on && <Icon name="check" size={11} />}
                {rating}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">API proxy (optional)</p>
        <p className="mb-3 text-xs text-muted">
          Leave empty — Zine automatically routes around MangaDex’s CORS block using a chain of
          public relays; no setup needed. If you ever want a private, faster relay instead, point
          this at any server that forwards to api.mangadex.org (a ready-made one-file worker ships
          in <code className="text-accent">cors-proxy/worker.js</code>).
        </p>
        <input
          type="url"
          value={apiProxy}
          onChange={(e) => setApiProxy(e.target.value)}
          placeholder="https://zine-mangadex.your-name.workers.dev"
          className="focus-ink w-full max-w-md rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
      </div>
    </div>
  )
}

/* ---------------------------------- Data ---------------------------------- */

function DataSettings() {
  const clearHistory = useLibrary((s) => s.clearHistory)
  const clearProgress = useLibrary((s) => s.clearProgress)
  const clearFavorites = useLibrary((s) => s.clearFavorites)
  const historyCount = useLibrary((s) => s.history.length)
  const favoritesCount = useLibrary((s) => Object.keys(s.favorites).length)

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          clearHistory()
          toast('History cleared.')
        }}
      >
        <Icon name="history" size={14} /> Clear history ({historyCount})
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          clearProgress()
          toast('Reading progress cleared.')
        }}
      >
        <Icon name="book" size={14} /> Clear progress
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          clearFavorites()
          toast('Favorites cleared.')
        }}
      >
        <Icon name="heart" size={14} /> Clear favorites ({favoritesCount})
      </Button>
    </div>
  )
}
