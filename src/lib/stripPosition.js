/**
 * Long-strip (vertical mode) geometry. Pure — no DOM, verified by
 * scripts/check-strip-position.mjs.
 */

/** One forward/back step scrolls this much of the viewport: the remaining
 *  15% stays on screen so the eye keeps its place across the jump. */
export const STRIP_STEP_RATIO = 0.85

/** Sub-pixel slack when deciding the strip is scrolled to an edge. */
const EDGE_SLACK_PX = 2

/**
 * Index of the page being read: the one under the reading line, i.e. the
 * vertical middle of the viewport.
 *
 * Why a line and not "how much of the page is visible": a webtoon strip is
 * often many screens tall, so no fixed visible fraction of it can ever be
 * on screen — a 50%-visible rule never fires for it and the reader's page
 * counter, saved progress and read marks all stall on page 1.
 *
 * At the very top the answer is the first page and at the very bottom the
 * last one, even when that page is too short to reach the middle (a small
 * credits image must still be able to finish the chapter).
 *
 * @param {number[]} tops top offset of every page within the scrolled content, ascending
 * @param {number} scrollTop
 * @param {number} viewportHeight
 * @param {number} scrollHeight total height of the scrolled content
 * @returns {number} page index, 0 when there are no pages
 */
export function pageAtReadingLine(tops, scrollTop, viewportHeight, scrollHeight) {
  const last = tops.length - 1
  if (last <= 0) return 0
  if (isAtStripEnd(scrollTop, viewportHeight, scrollHeight)) return last
  if (scrollTop <= EDGE_SLACK_PX) return 0

  const line = scrollTop + viewportHeight / 2
  // Binary search for the last page whose top edge is at or above the line.
  let low = 0
  let high = last
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (tops[mid] <= line) low = mid
    else high = mid - 1
  }
  return low
}

/** True when the strip cannot scroll any further down. */
export function isAtStripEnd(scrollTop, viewportHeight, scrollHeight) {
  return scrollTop + viewportHeight >= scrollHeight - EDGE_SLACK_PX
}

/** True when the strip is scrolled all the way up. */
export function isAtStripStart(scrollTop) {
  return scrollTop <= EDGE_SLACK_PX
}

/** Pixels one forward/back step moves, for a given viewport height. */
export function stripStep(viewportHeight) {
  return Math.max(1, Math.round(viewportHeight * STRIP_STEP_RATIO))
}
