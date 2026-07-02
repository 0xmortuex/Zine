import { get, set, del } from 'idb-keyval'

const KEY = 'zine:bg'
const MAX_DIMENSION = 2560

/* Change notifications so BackgroundLayer reloads after upload/remove. */
const listeners = new Set()

export function subscribeBackgroundChanges(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyBackgroundChanged() {
  for (const listener of listeners) listener()
}

/**
 * Downscale an image file on a canvas (max 2560px on the long edge) and
 * store the resulting blob in IndexedDB. Returns the stored blob.
 */
export async function saveBackground(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  let blob = file
  if (scale < 1) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  }
  bitmap.close()
  await set(KEY, blob)
  return blob
}

export function loadBackground() {
  return get(KEY)
}

export function clearBackground() {
  return del(KEY)
}
