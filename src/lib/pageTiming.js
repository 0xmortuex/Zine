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
    // Sparse spreads run a touch under base; a full page of dialogue gets up
    // to ~4.5x — reading a wall of speech bubbles genuinely takes that long,
    // and readers strongly prefer lingering over being rushed past unread
    // text. Calibrated generous by design.
    multiplier *= clamp(0.6 + busyness * 3.9, 0.6, 4.5)
  }
  // Never under 4s (even a splash page deserves a look), never over 2min.
  return clamp(baseSeconds * multiplier, 4, 120)
}

/**
 * Sample visual density from a loaded <img>. Reading TEXT is the real time
 * cost of a page, so the score is led by a text signal: thin dark marks
 * sitting on a bright ground (speech-bubble lettering). Large black fills
 * — hair, shadow, display lettering — fail that test because their
 * neighborhood stays dark, so they don't inflate the estimate despite
 * their area. Edge transitions per row are CAPPED before summing so heavy
 * action hatching/screentone (which saturates rows with edges but takes
 * little time to read) can't dominate. Ink coverage gets only a small
 * weight for the same reason.
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
    let textInk = 0 // fine dark strokes on a bright ground → lettering
    for (let y = 0; y < h; y++) {
      let rowEdges = 0
      for (let x = 1; x < w; x++) {
        const idx = y * w + x
        const v = luma[idx]
        if (Math.abs(v - luma[idx - 1]) > 40) rowEdges++
        // Text signature: an ink pixel with a near-white pixel a few px away
        // on the same row. Bubble text is thin black on white; a big black
        // fill fails because its whole neighborhood is dark.
        if (v < 96) {
          let bright = 0
          for (let k = 1; k <= 3; k++) {
            if (x + k < w) bright = Math.max(bright, luma[idx + k])
            if (x - k >= 0) bright = Math.max(bright, luma[idx - k])
          }
          if (bright > 180) textInk++
        }
      }
      edges += Math.min(rowEdges, rowCap)
    }
    const edgeRatio = edges / total // ≤ 0.35 by construction
    const inkRatio = ink / total
    const textRatio = textInk / total
    // Text leads (it's what you actually read); edges/ink add general
    // busyness. Weights are heuristic — tuned so a dialogue-heavy page
    // approaches 1 while sparse art stays low — and best re-checked in the
    // browser (this path is exercised by the reader smoke test).
    return clamp(textRatio * 5.5 + edgeRatio * 3.2 + inkRatio * 0.25, 0, 1)
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
