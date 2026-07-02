/**
 * Theme preset registry. The actual color values live in src/index.css as
 * [data-theme=...] variable blocks; this file only describes them for the
 * settings UI (labels + preview swatches).
 */
export const THEMES = [
  {
    id: 'midnight',
    label: 'Midnight',
    dark: true,
    swatches: ['oklch(0.16 0.02 265)', 'oklch(0.255 0.024 265)', 'oklch(0.72 0.16 250)'],
  },
  {
    id: 'ember',
    label: 'Ember',
    dark: true,
    swatches: ['oklch(0.15 0.005 285)', 'oklch(0.25 0.007 285)', 'oklch(0.7 0.19 45)'],
  },
  {
    id: 'void',
    label: 'Void',
    dark: true,
    swatches: ['oklch(0 0 0)', 'oklch(0.19 0 0)', 'oklch(0.63 0.24 27)'],
  },
  {
    id: 'paper',
    label: 'Paper',
    dark: false,
    swatches: ['oklch(0.965 0.012 90)', 'oklch(1 0 0)', 'oklch(0.45 0.15 260)'],
  },
  {
    id: 'sakura',
    label: 'Sakura',
    dark: false,
    swatches: ['oklch(0.955 0.018 350)', 'oklch(1 0 0)', 'oklch(0.6 0.2 5)'],
  },
  {
    id: 'matcha',
    label: 'Matcha',
    dark: true,
    swatches: ['oklch(0.2 0.025 150)', 'oklch(0.295 0.03 150)', 'oklch(0.76 0.14 140)'],
  },
]

export const DEFAULT_THEME = 'midnight'

export function applyTheme(id) {
  document.documentElement.dataset.theme = id
}
