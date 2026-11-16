// Checks for the global-shortcut gate (src/hooks/useKeyboard.js).
// Run: node scripts/check-keyboard.mjs
import assert from 'node:assert/strict'
import { shouldHandleShortcut } from '../src/hooks/useKeyboard.js'

/* A tiny stand-in for DOM nodes: tagName, attributes, parent, and a
 * closest() that understands the handful of selector shapes the gate uses. */
function node(tagName, { attrs = {}, parent = null, editable = false } = {}) {
  const self = {
    tagName: tagName.toUpperCase(),
    attrs,
    parent,
    isContentEditable: editable,
    matches(selector) {
      const attr = selector.match(/^(\w*)\[([\w-]+)(?:="([^"]*)")?\]$/)
      if (attr) {
        const [, tag, name, value] = attr
        if (tag && tag.toUpperCase() !== self.tagName) return false
        return value === undefined ? name in self.attrs : self.attrs[name] === value
      }
      return selector.toUpperCase() === self.tagName
    },
    closest(selectorList) {
      const selectors = selectorList.split(',').map((s) => s.trim())
      for (let n = self; n; n = n.parent) {
        if (selectors.some((s) => n.matches(s))) return n
      }
      return null
    },
  }
  return self
}

const key = (k, target, mods = {}) => ({
  key: k,
  target,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  ...mods,
})

const body = node('body')
const button = node('button', { parent: body })
const iconInsideButton = node('svg', { parent: button })
const link = node('a', { attrs: { href: '/manga/1' }, parent: body })
const anchorWithoutHref = node('a', { parent: body })
const radio = node('button', { attrs: { role: 'radio' }, parent: body })
const toggle = node('button', { attrs: { role: 'switch' }, parent: body })

// --- browser / OS chords are never shortcuts ---
assert.equal(shouldHandleShortcut(key('f', body, { ctrlKey: true })), false, 'Ctrl+F is find-in-page')
assert.equal(shouldHandleShortcut(key('ArrowLeft', body, { altKey: true })), false, 'Alt+Left is browser back')
assert.equal(shouldHandleShortcut(key('ArrowRight', body, { metaKey: true })), false, 'Cmd+Right is browser forward')
assert.equal(shouldHandleShortcut(key(',', body, { ctrlKey: true })), false)
assert.equal(shouldHandleShortcut(key('F', body, { shiftKey: true })), true, 'Shift is part of the key, not a chord')
console.log('modifier chords pass through ok')

// --- plain keys on the page are shortcuts ---
for (const k of ['ArrowLeft', 'ArrowRight', ' ', 'f', 'm', 'z', ',', '.', 'Escape']) {
  assert.equal(shouldHandleShortcut(key(k, body)), true, `${JSON.stringify(k)} on the page`)
}
assert.equal(shouldHandleShortcut(key(' ', null)), true, 'no target (window-level dispatch)')
assert.equal(shouldHandleShortcut(key(' ', {})), true, 'non-element target')
console.log('plain keys handled ok')

// --- typing is never a shortcut ---
for (const tag of ['input', 'textarea', 'select']) {
  assert.equal(shouldHandleShortcut(key('f', node(tag, { parent: body }))), false, `typing in <${tag}>`)
  assert.equal(shouldHandleShortcut(key('ArrowLeft', node(tag, { parent: body }))), false)
}
assert.equal(shouldHandleShortcut(key('m', node('div', { parent: body, editable: true }))), false)
console.log('text entry ignored ok')

// --- an already-handled event is left alone ---
assert.equal(shouldHandleShortcut(key('Escape', body, { defaultPrevented: true })), false)
console.log('defaultPrevented respected ok')

// --- Space/Enter: the focused control wins only when focus came from the keyboard ---
for (const control of [button, iconInsideButton, link, radio, toggle]) {
  for (const k of [' ', 'Enter']) {
    assert.equal(shouldHandleShortcut(key(k, control), true), false, `${k === ' ' ? 'Space' : k} on a Tab-focused control`)
    assert.equal(shouldHandleShortcut(key(k, control), false), true, `${k === ' ' ? 'Space' : k} on a mouse-focused control stays global`)
  }
}
assert.equal(shouldHandleShortcut(key(' ', anchorWithoutHref), true), true, '<a> without href is not a control')
assert.equal(shouldHandleShortcut(key(' ', body), true), true, 'Space on the page itself, keyboard modality')
// Other keys keep working while a control is keyboard-focused.
assert.equal(shouldHandleShortcut(key('ArrowLeft', button), true), true)
assert.equal(shouldHandleShortcut(key('Escape', button), true), true)
assert.equal(shouldHandleShortcut(key('f', toggle), true), true)
console.log('Space/Enter routing by focus modality ok')

console.log('\nall keyboard checks passed')
