import { useEffect, useRef } from 'react'

const TEXT_ENTRY = /^(input|textarea|select)$/i

/** Controls that own Space/Enter when the keyboard put focus on them. */
const ACTIVATABLE =
  'button, a[href], summary, [role="button"], [role="radio"], [role="switch"], [role="option"]'

/**
 * Should a global shortcut fire for this keydown? Pure — verified by
 * scripts/check-keyboard.mjs.
 *
 *  - Browser/OS chords (Ctrl+F find, Alt+← back, ⌘→ …) are never ours.
 *  - Typing into a field is never a shortcut.
 *  - Space/Enter belong to the focused control when the user TABBED to it,
 *    so a keyboard user can press the button they are on. A control that
 *    merely kept focus after a mouse click or tap does not claim them:
 *    clicking "+" on the timer and then hitting Space still means
 *    play/pause, not "+ again".
 *
 * @param {KeyboardEvent} event
 * @param {boolean} focusFromKeyboard whether the focused element got its
 *   focus from the keyboard (see the modality tracker below)
 */
export function shouldHandleShortcut(event, focusFromKeyboard = false) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.defaultPrevented) return false
  const target = event.target
  if (!target || typeof target.closest !== 'function') return true
  if (TEXT_ENTRY.test(target.tagName ?? '') || target.isContentEditable) return false
  if ((event.key === ' ' || event.key === 'Enter') && focusFromKeyboard) {
    if (target.closest(ACTIVATABLE)) return false
  }
  return true
}

/* Focus modality: did the currently focused element receive focus by
 * keyboard (Tab) or by pointer? :focus-visible cannot answer this at
 * keydown time — browsers flip it to true on ANY key press, including on a
 * button that was focused by a mouse click. */
let focusFromKeyboard = false
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  let lastInputWasKeyboard = false
  window.addEventListener('pointerdown', () => (lastInputWasKeyboard = false), true)
  window.addEventListener('keydown', (e) => e.key === 'Tab' && (lastInputWasKeyboard = true), true)
  window.addEventListener('focusin', () => (focusFromKeyboard = lastInputWasKeyboard), true)
}

/**
 * Declarative keyboard shortcut map: { 'ArrowLeft': fn, ' ': fn, f: fn }.
 * Which keydowns qualify is decided by shouldHandleShortcut above.
 */
export function useKeyboard(map) {
  const mapRef = useRef(map)
  mapRef.current = map

  useEffect(() => {
    function onKeyDown(event) {
      if (!shouldHandleShortcut(event, focusFromKeyboard)) return
      const handler = mapRef.current[event.key]
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
