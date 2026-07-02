import { Link, NavLink } from 'react-router-dom'
import BackgroundLayer from './BackgroundLayer'
import ToastStack from './Toast'
import Icon from './ui/Icon'
import clsx from 'clsx'
import { USING_FIXTURES } from '../api'

/**
 * App chrome: masthead with the lowercase wordmark, hairline rule, content
 * outlet. The reader route renders outside this (immersive).
 */
export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
      <BackgroundLayer />

      <header className="frosted sticky top-0 z-40 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="focus-ink group flex items-baseline gap-2">
            <span className="text-display text-2xl lowercase">zine.</span>
            <span className="hidden text-[0.65rem] font-semibold tracking-[0.22em] text-muted uppercase sm:inline">
              personal manga index
            </span>
            {USING_FIXTURES && (
              <span className="stamp stamp-accent" title="VITE_USE_FIXTURES is set — showing generated stand-in data, not live MangaDex">
                offline fixtures
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-1">
            <HeaderLink to="/" end icon="search" label="Browse" />
            <HeaderLink to="/settings" icon="settings" label="Settings" />
          </nav>
        </div>
        <div className="rule-h" />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-6 pt-8 pb-10">
        <div className="rule-h mb-4" />
        <p className="text-[0.65rem] tracking-[0.2em] text-muted uppercase">
          zine · data via mangadex api
        </p>
      </footer>

      <ToastStack />
    </div>
  )
}

function HeaderLink({ to, end = false, icon, label }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'focus-ink flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase',
          isActive ? 'text-accent' : 'text-muted hover:text-text',
        )
      }
    >
      <Icon name={icon} size={15} />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )
}
