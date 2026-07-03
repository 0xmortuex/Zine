/**
 * Smart autoplay timing: estimate how long an average reader needs on a
 * page. Where pixel data is readable (local imports, fixtures — same
 * origin) we sample the page for visual density; cross-origin pages
 * (MangaDex CDN taints the canvas) fall back to shape-based estimation.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Reference manga page aspect (height/width). Taller pages read longer. */
const STANDARD_ASPECT = 1.45

/**
 * Pure timing model — node-testable.
 * @param {number} baseSeconds user's configured per-page base
 * @param {number} aspect page height/width
 * @param {number|null} busyness 0..1 visual density, null if unknown
 */
export function computeReadSeconds(baseSeconds, aspect, busyness) {
  let multiplier = clamp(aspect / STANDARD_ASPECT, 0.75, 3)
  if (busyness != null) {
    // Sparse spread pages (~0.15) read fast; text/panel-dense pages (~0.8+)
    // need roughly double the time.
    multiplier *= clamp(0.55 + busyness * 1.6, 0.55, 2.1)
  }
  return clamp(baseSeconds * multiplier, 2, 90)
}

/**
 * Sample visual density from a loaded <img>: edge frequency (text and
 * panel linework) + ink coverage. Returns 0..1, or null when the canvas
 * is tainted (cross-origin) or sampling fails.
 */
export function measureBusyness(img) {
  try {
    if (!img?.naturalWidth) return null
    const w = 64
    const h = clamp(Math.round((img.naturalHeight / img.naturalWidth) * w), 8, 256)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h) // throws if tainted

    let edges = 0
    let ink = 0
    const total = w * h
    const luma = new Float32Array(total)
    for (let i = 0; i < total; i++) {
      const o = i * 4
      luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
      if (luma[i] < 96) ink++
    }
    for (let y = 0; y < h; y++) {
      for (let x = 1; x < w; x++) {
        if (Math.abs(luma[y * w + x] - luma[y * w + x - 1]) > 40) edges++
      }
    }
    const edgeRatio = edges / total // dense manga pages land ~0.05–0.25
    const inkRatio = ink / total
    return clamp(edgeRatio * 4 + inkRatio * 0.8, 0, 1)
  } catch {
    return null
  }
}

/** Full estimate for a loaded <img> element. */
export function estimateReadSeconds(img, baseSeconds) {
  if (!img?.naturalWidth) return baseSeconds
  const aspect = img.naturalHeight / img.naturalWidth
  return computeReadSeconds(baseSeconds, aspect, measureBusyness(img))
}
