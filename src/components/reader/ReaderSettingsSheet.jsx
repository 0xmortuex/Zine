import { AnimatePresence, motion } from 'motion/react'
import SegmentedControl from '../ui/SegmentedControl'
import Slider from '../ui/Slider'
import Toggle from '../ui/Toggle'
import IconButton from '../ui/IconButton'
import { useSettings } from '../../store/useSettings'

/**
 * In-reader quick settings bottom sheet — change mode/fit/direction/timer
 * without leaving the chapter.
 */
export default function ReaderSettingsSheet({ open, onClose }) {
  const reader = useSettings((s) => s.reader)
  const setReader = useSettings((s) => s.setReader)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="frosted fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-b-0 border-border bg-surface p-6 pb-8"
            role="dialog"
            aria-label="Reader settings"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-display text-lg lowercase">reader settings.</p>
              <IconButton icon="close" label="Close" onClick={onClose} />
            </div>

            <div className="space-y-5">
              <Row label="Mode">
                <SegmentedControl
                  label="Mode"
                  value={reader.mode}
                  onChange={(mode) => setReader({ mode })}
                  options={[
                    { value: 'paged', label: 'Paged' },
                    { value: 'vertical', label: 'Vertical' },
                  ]}
                />
              </Row>
              {reader.mode === 'paged' && (
                <>
                  <Row label="Fit">
                    <SegmentedControl
                      label="Fit"
                      value={reader.fit}
                      onChange={(fit) => setReader({ fit })}
                      options={[
                        { value: 'height', label: 'Height' },
                        { value: 'width', label: 'Width' },
                        { value: 'original', label: 'Original' },
                      ]}
                    />
                  </Row>
                  <Row label="Direction">
                    <SegmentedControl
                      label="Direction"
                      value={reader.direction}
                      onChange={(direction) => setReader({ direction })}
                      options={[
                        { value: 'rtl', label: 'R → L' },
                        { value: 'ltr', label: 'L → R' },
                      ]}
                    />
                  </Row>
                </>
              )}
              <Slider
                label={reader.mode === 'paged' ? 'Autoplay timer' : 'Scroll speed'}
                value={reader.mode === 'paged' ? reader.autoplayInterval : reader.autoScrollSpeed}
                onChange={(value) =>
                  setReader(
                    reader.mode === 'paged' ? { autoplayInterval: value } : { autoScrollSpeed: value },
                  )
                }
                min={reader.mode === 'paged' ? 1 : 40}
                max={reader.mode === 'paged' ? 60 : 400}
                step={reader.mode === 'paged' ? 1 : 10}
                format={(v) => (reader.mode === 'paged' ? `${v}s` : `${v}px/s`)}
              />
              {reader.mode === 'paged' && (
                <Row label="Smart page timing">
                  <Toggle
                    checked={reader.smartTiming}
                    onChange={(smartTiming) => setReader({ smartTiming })}
                    label="Smart page timing"
                  />
                </Row>
              )}
              <Row label="Data saver">
                <Toggle
                  checked={reader.dataSaver}
                  onChange={(dataSaver) => setReader({ dataSaver })}
                  label="Data saver"
                />
              </Row>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted">{label}</p>
      {children}
    </div>
  )
}
