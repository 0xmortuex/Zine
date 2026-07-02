/**
 * Minimal inline icon set (24×24, stroke-based) so the app carries its own
 * glyph style instead of a stock icon library.
 */
const PATHS = {
  search: <path d="M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.8-4.8" />,
  heart: (
    <path d="M12 20.5S4 15.5 4 9.8C4 6.9 6.2 5 8.5 5c1.5 0 2.8.8 3.5 2 0.7-1.2 2-2 3.5-2C17.8 5 20 6.9 20 9.8c0 5.7-8 10.7-8 10.7Z" />
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="15.5" cy="7" r="2.5" />
      <circle cx="7.5" cy="17" r="2.5" />
    </>
  ),
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronDown: <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  play: <path d="M7.5 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5Z" />,
  pause: <path d="M7.5 5v14M16.5 5v14" />,
  skipBack: <path d="M18 5.5 9.5 12l8.5 6.5v-13ZM6 5.5v13" />,
  skipForward: <path d="m6 5.5 8.5 6.5L6 18.5v-13ZM18 5.5v13" />,
  pageBack: <path d="m13 6-6 6 6 6M19 6l-6 6 6 6" />,
  pageForward: <path d="m5 6 6 6-6 6M11 6l6 6-6 6" />,
  fullscreen: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  minimize: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  external: <path d="M14 4h6v6M20 4l-9 9M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />,
  check: <path d="m5 12.5 5 5L19.5 7" />,
  book: <path d="M12 6.5C10.5 5 8.5 4.5 4.5 4.5v14c4 0 6 .5 7.5 2 1.5-1.5 3.5-2 7.5-2v-14c-4 0-6 .5-7.5 2Zm0 0v14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2.5" />
    </>
  ),
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" />,
  trash: <path d="M5 7h14M10 7V5h4v2m-8 0 1 13h10l1-13M10 11v6M14 11v6" />,
  arrowLeft: <path d="M20 12H4m0 0 6-6m-6 6 6 6" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  columns: <path d="M5 4h6v16H5zM13 4h6v16h-6z" />,
  rows: <path d="M4 5h16v6H4zM4 13h16v6H4z" />,
  history: (
    <>
      <path d="M4 12a8 8 0 1 1 2.3 5.7M4 12l-1.5-3M4 12l3-1" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  timer: <path d="M12 7v5l3.5 2M9 3h6M12 3v2m7.5 1.5L18 8M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />,
}

export default function Icon({ name, size = 20, className, filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}
