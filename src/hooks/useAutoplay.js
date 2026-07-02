import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Pure autoplay stepper — the frame-by-frame accumulator logic, extracted
 * so scripts/check-autoplay.mjs can verify it with fake timestamps.
 *
 * State: { elapsed, playing, lastTs }
 */
export function createStepper(duration) {
  return {
    state: { elapsed: 0, playing: false, lastTs: null },

    step(ts) {
      const s = this.state
      if (!s.playing) return { progress: this.progress(), completed: false }
      if (s.lastTs != null) s.elapsed += ts - s.lastTs
      s.lastTs = ts
      const completed = s.elapsed >= duration
      if (completed) s.elapsed = duration
      return { progress: this.progress(), completed }
    },

    progress() {
      return duration > 0 ? Math.min(1, this.state.elapsed / duration) : 0
    },

    play() {
      this.state.playing = true
      this.state.lastTs = null // don't count time spent paused
    },

    pause() {
      this.state.playing = false
      this.state.lastTs = null
    },

    reset() {
      this.state.elapsed = 0
      this.state.lastTs = null
    },

    setDuration(next) {
      duration = next
    },
  }
}

/**
 * Reader autoplay engine.
 *
 * const { playing, play, pause, toggle, subscribeProgress } = useAutoplay({
 *   duration,       // ms per cycle
 *   onComplete,     // fires at cycle end; async — advance the page. The
 *                   // cycle resets when resetKey changes (i.e. page turned).
 *   resetKey,       // page index; changing it restarts the cycle
 *   enabled,        // hard gate (pages loading, sheet open, ...)
 * })
 *
 * Progress is NOT React state — subscribe via subscribeProgress(fn) and
 * paint from the callback (the ring uses this) so the reader never
 * re-renders at 60fps.
 */
export function useAutoplay({ duration, onComplete, resetKey, enabled = true }) {
  const [playing, setPlaying] = useState(false)
  const stepperRef = useRef(null)
  if (!stepperRef.current) stepperRef.current = createStepper(duration)
  stepperRef.current.setDuration(duration)

  const listenersRef = useRef(new Set())
  const completingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const emit = useCallback((progress) => {
    for (const listener of listenersRef.current) listener(progress)
  }, [])

  // Cycle restart on page change.
  useEffect(() => {
    stepperRef.current.reset()
    completingRef.current = false
    emit(0)
  }, [resetKey, emit])

  // rAF loop.
  useEffect(() => {
    if (!playing || !enabled) {
      stepperRef.current.pause()
      return
    }
    stepperRef.current.play()
    let frame
    const tick = (ts) => {
      const { progress, completed } = stepperRef.current.step(ts)
      emit(progress)
      if (completed && !completingRef.current) {
        completingRef.current = true
        // Hold at 100% while onComplete resolves (e.g. waiting for the
        // next image); the resetKey change then resets the cycle.
        Promise.resolve(onCompleteRef.current?.()).then((advanced) => {
          if (advanced === false) {
            setPlaying(false)
            completingRef.current = false
            stepperRef.current.reset()
            emit(0)
          }
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, enabled, emit])

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying((v) => !v), [])

  const subscribeProgress = useCallback((listener) => {
    listenersRef.current.add(listener)
    listener(stepperRef.current.progress())
    return () => listenersRef.current.delete(listener)
  }, [])

  return { playing: playing && enabled, play, pause, toggle, subscribeProgress }
}
