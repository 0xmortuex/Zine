import { useEffect, useRef } from 'react'

const RADIUS = 15
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * SVG progress ring painted directly from autoplay progress subscriptions —
 * no React re-renders at 60fps.
 */
export default function AutoplayRing({ subscribeProgress, size = 38 }) {
  const circleRef = useRef(null)

  useEffect(
    () =>
      subscribeProgress((progress) => {
        const circle = circleRef.current
        if (circle) {
          circle.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress))
        }
      }),
    [subscribeProgress],
  )

  return (
    <svg
      viewBox="0 0 34 34"
      width={size}
      height={size}
      className="pointer-events-none absolute inset-0 m-auto -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx="17"
        cy="17"
        r={RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        opacity="0.6"
      />
      <circle
        ref={circleRef}
        cx="17"
        cy="17"
        r={RADIUS}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
      />
    </svg>
  )
}
