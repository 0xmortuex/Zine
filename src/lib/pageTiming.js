/**
 * Smart autoplay timing: estimate how long an average reader needs on a
 * page. Where pixel data is readable (local imports, PDFs, fixtures — same
 * origin) we sample the page for visual density; cross-origin pages
 * (remote CDNs taint the canvas) fall back to shape-based estimation.
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
  let multiplier = clamp(aspect / STANDARD_ASPECT, 0.8, 3)
  if (busyness != null) {
    // Sparse spreads run a touch under base; text/panel-dense pages get up
    // to ~3x. Calibrated generous: readers prefer lingering over rushing.
    multiplier *= clamp(0.7 + busyness * 2.6, 0.7, 3)
  }
  // Never under 4s (even a splash page deserves a look), never over 2min.
  return clamp(baseSeconds * multiplier, 4, 120)
}

/**
 * Sample visual density from a loaded <img>. Edge transitions per row are
 * CAPPED before summing so heavy action hatching/screentone (which
 * saturates rows with edges but takes little time to "read") can't
 * dominate the score the way real text — many moderately-edgy rows — does.
 * Ink coverage gets only a small weight for the same reason: big black
 * display lettering is fast to read despite its area.
 * Returns 0..1, or null when the canvas is tainted (cross-origin).
 */
export function measureBusyness(img) {
  try {
    if (!img?.naturalWidth) return null
    const w = 96
    const h = clamp(Math.round((img.naturalHeight / img.naturalWidth) * w), 8, 384)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h) // throws if tainted

    const total = w * h
    const luma = new Float32Array(total)
    let ink = 0
    for (let i = 0; i < total; i++) {
      const o = i * 4
      luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
      if (luma[i] < 96) ink++
    }

    const rowCap = Math.round(w * 0.35)
    let edges = 0
    for (let y = 0; y < h; y++) {
      let rowEdges = 0
      for (let x = 1; x < w; x++) {
        if (Math.abs(luma[y * w + x] - luma[y * w + x - 1]) > 40) rowEdges++
      }
      edges += Math.min(rowEdges, rowCap)
    }
    const edgeRatio = edges / total // ≤ 0.35 by construction
    const inkRatio = ink / total
    return clamp(edgeRatio * 4.5 + inkRatio * 0.35, 0, 1)
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
