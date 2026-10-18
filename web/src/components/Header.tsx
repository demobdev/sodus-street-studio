import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { site } from '../content/site'

export function Header() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const { key } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [key])

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButton.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <header className="sticky top-0 z-50 flex max-h-[100dvh] flex-col border-b border-navy/10 bg-ivory/95 backdrop-blur">
      <div className="container-site flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3 md:px-8 lg:px-12">
        <Link
          to="/"
          className="flex min-w-0 shrink items-center"
          onClick={() => setOpen(false)}
        >
          <img
            src="/logo.png"
            alt="Sodus Street Studio"
            className="h-9 w-auto max-w-[42vw] object-contain object-left sm:h-11 sm:max-w-[220px] md:h-12 md:max-w-[240px] lg:h-14 lg:max-w-none"
          />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-5 xl:flex">
          {site.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center text-sm font-medium tracking-wide transition hover:text-gold-dark ${
                  isActive ? 'text-gold-dark' : 'text-navy'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/booking" className="btn-primary hidden sm:inline-flex">
            Book a Session
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-navy/20 text-navy xl:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">Menu</span>
            <div className="space-y-1.5">
              <span className={`block h-0.5 w-5 bg-navy transition ${open ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 bg-navy transition ${open ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-navy transition ${open ? '-translate-y-2 -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-navigation" className="min-h-0 overflow-y-auto overscroll-contain border-t border-navy/10 bg-ivory px-5 py-4 xl:hidden">
          <nav aria-label="Primary navigation" className="flex flex-col gap-3">
            {site.nav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) => `inline-flex min-h-11 items-center py-2 text-base font-medium ${isActive ? 'text-gold-dark' : 'text-navy'}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/booking"
              className="btn-primary mt-2"
              onClick={() => setOpen(false)}
            >
              Book a Session
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
