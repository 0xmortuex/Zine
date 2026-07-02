import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import BackgroundLayer from './BackgroundLayer'
import ToastStack from './Toast'
import Icon from './ui/Icon'
import clsx from 'clsx'
import { USING_FIXTURES } from '../api'
import { useLayoutMode } from '../hooks/useLayoutMode'

/**
 * App chrome. Desktop: masthead with inline nav. Mobile (auto-detected or
 * forced in Settings): masthead slims down and navigation moves to a fixed
 * app-style bottom bar. The reader route renders outside this entirely.
 */
export default function Layout({ children }) {
  const mode = useLayoutMode()
  const isMobile = mode === 'mobile'

  return (
    <div className="min-h-screen">
      <BackgroundLayer />

      <header className="frosted sticky top-0 z-40 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="focus-ink group flex items-baseline gap-2">
            <span className="text-display text-2xl lowercase">zine.</span>
            {!isMobile && (
              <span className="hidden text-[0.65rem] font-semibold tracking-[0.22em] text-muted uppercase sm:inline">
                personal manga index
              </span>
            )}
            {USING_FIXTURES && (
              <span className="stamp stamp-accent" title="VITE_USE_FIXTURES is set — showing generated stand-in data, not live MangaDex">
                offline fixtures
              </span>
            )}
          </Link>
          {!isMobile && (
            <nav className="flex items-center gap-1">
              <HeaderLink to="/" end icon="search" label="Browse" />
              <HeaderLink to="/settings" icon="settings" label="Settings" />
            </nav>
          )}
        </div>
        <div className="rule-h" />
      </header>

      <main className={clsx('mx-auto max-w-6xl px-6 py-8', isMobile && 'pb-28')}>{children}</main>

      <footer className={clsx('mx-auto max-w-6xl px-6 pt-8', isMobile ? 'pb-28' : 'pb-10')}>
        <div className="rule-h mb-4" />
        <p className="text-[0.65rem] tracking-[0.2em] text-muted uppercase">
          zine · data via mangadex api
        </p>
      </footer>

      {isMobile && <MobileNav />}

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

/* ------------------------------ mobile chrome ----------------------------- */

const MOBILE_TABS = [
  { key: 'browse', to: '/', icon: 'search', label: 'browse' },
  { key: 'library', to: '/?tab=library', icon: 'heart', label: 'library' },
  { key: 'history', to: '/?tab=history', icon: 'history', label: 'history' },
  { key: 'settings', to: '/settings', icon: 'settings', label: 'settings' },
]

function MobileNav() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const tab = params.get('tab')

  const activeKey = pathname.startsWith('/settings')
    ? 'settings'
    : tab === 'library'
      ? 'library'
      : tab === 'history'
        ? 'history'
        : 'browse'

  return (
    <nav
      className="frosted fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {MOBILE_TABS.map((item) => {
          const active = activeKey === item.key
          return (
            <Link
              key={item.key}
              to={item.to}
              className={clsx(
                'focus-ink relative flex flex-1 flex-col items-center gap-1 py-2.5',
                active ? 'text-accent' : 'text-muted',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-ink"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                />
              )}
              <Icon name={item.icon} size={20} filled={active && item.key === 'library'} />
              <span className="text-[0.6rem] font-bold tracking-[0.18em] uppercase">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
