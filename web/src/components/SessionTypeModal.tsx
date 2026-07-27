import { useEffect } from 'react'
import type { SessionType } from '../content/sessions'

type Props = {
  session: SessionType | null
  onClose: () => void
  onBook: (sessionTitle: string) => void
}

export function SessionTypeModal({ session, onClose, onBook }: Props) {
  useEffect(() => {
    if (!session) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [session, onClose])

  if (!session) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-gold/30 bg-ivory shadow-soft animate-fade-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5">
          <div>
            <p className="section-label">Session Type</p>
            <h2 id="session-modal-title" className="mt-2 font-display text-3xl text-navy md:text-4xl">
              {session.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 inline-flex h-9 w-9 items-center justify-center border border-navy/15 text-xl text-navy transition hover:border-gold hover:text-gold-dark"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
          <div>
            <p className="text-lg leading-relaxed text-navy-muted">{session.description}</p>
            <p className="mt-4 font-display text-3xl text-gold-dark">{session.rateLabel}</p>
            <p className="mt-1 text-sm text-navy-muted">{session.rateNote}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
                Duration Options
              </h3>
              <ul className="mt-3 space-y-2 text-navy-muted">
                {session.durations.map((item) => (
                  <li key={item} className="border-b border-navy/10 pb-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
                Best For
              </h3>
              <ul className="mt-3 space-y-2 text-navy-muted">
                {session.bestFor.map((item) => (
                  <li key={item} className="border-b border-navy/10 pb-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
              What to Expect
            </h3>
            <ul className="mt-3 space-y-2 text-navy-muted">
              {session.includes.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">
              We’ll Ask About
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-navy-muted">
              {session.intakeHints.join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-navy/10 bg-ivory-warm px-6 py-5">
          <button
            type="button"
            className="btn-primary"
            onClick={() => onBook(session.title)}
          >
            Book This Session
          </button>
          <button type="button" className="btn-outline" onClick={onClose}>
            Keep Browsing
          </button>
        </div>
      </div>
    </div>
  )
}
