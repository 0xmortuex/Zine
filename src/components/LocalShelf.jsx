import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import MangaGrid from './MangaGrid'
import Button from './ui/Button'
import Icon from './ui/Icon'
import { toast } from '../store/useToasts'
import { listLocalManga, importChapters, normalizeLocalManga } from '../lib/localLibrary'

/** Guess a series title from "One Slash Ch. 12.cbz" → "One Slash". */
function deriveTitle(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const stripped = stem.replace(/[\s._-]*(?:ch(?:apter)?|c|vol(?:ume)?|v)[\s._-]*\d+.*$/i, '')
  return (stripped || stem).replace(/[-_.]+/g, ' ').trim()
}

/**
 * "On device" shelf: manga imported manually as .cbz/.zip archives or image
 * files. Stored in IndexedDB, readable fully offline — no network involved.
 */
export default function LocalShelf() {
  const [entries, setEntries] = useState(null)
  const [pending, setPending] = useState(null) // { files, title }
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const refresh = () => listLocalManga().then(setEntries)

  useEffect(() => {
    refresh()
  }, [])

  function handleFiles(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length === 0) return
    setPending({ files, title: deriveTitle(files[0].name) })
  }

  async function handleImport() {
    if (!pending) return
    setBusy(true)
    try {
      const manga = await importChapters(pending.title, pending.files)
      const added = manga.chapters.length
      toast(`Imported “${manga.title}” — ${added} chapter${added === 1 ? '' : 's'} on device.`, {
        kind: 'success',
      })
      setPending(null)
      refresh()
    } catch (err) {
      toast(`Import failed: ${err.message}`, { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h3 className="text-display text-lg lowercase">on device.</h3>
        {entries?.length > 0 && <span className="tnum text-sm text-muted">{entries.length}</span>}
        <div className="rule-h flex-1 self-center" />
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={14} /> Import
        </Button>
      </div>

      <p className="mb-6 text-xs text-muted">
        Add your own manga: chapter archives (<code>.cbz</code>/<code>.zip</code>) or image files.
        They're stored in this browser and read fully offline — no servers involved.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept=".cbz,.zip,image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-accent/40 bg-surface p-4"
          >
            <div className="min-w-52 flex-1">
              <label
                htmlFor="local-import-title"
                className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase"
              >
                Series title · {pending.files.length} file{pending.files.length === 1 ? '' : 's'}
              </label>
              <input
                id="local-import-title"
                type="text"
                value={pending.title}
                onChange={(e) => setPending({ ...pending, title: e.target.value })}
                className="focus-ink w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <Button variant="primary" onClick={handleImport} disabled={busy || !pending.title.trim()}>
              {busy ? 'Importing…' : 'Add to shelf'}
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {entries?.length > 0 && <MangaGrid items={entries.map(normalizeLocalManga)} />}

      {entries?.length === 0 && !pending && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
          Nothing on this device yet — hit Import to add your own chapters.
        </p>
      )}
    </section>
  )
}
