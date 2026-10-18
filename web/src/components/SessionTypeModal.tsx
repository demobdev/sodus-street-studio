import { useEffect, useRef } from 'react'
import type { SessionType } from '../content/sessions'

type Props = {
  session: SessionType | null
  onClose: () => void
  onBook: (sessionTitle: string) => void
}

export function SessionTypeModal({ session, onClose, onBook }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!session) return

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0)

      event.preventDefault()
      if (!controls.length) {
        dialog.focus({ preventScroll: true })
        return
      }
      const current = controls.indexOf(document.activeElement as HTMLElement)
      const next = current === -1
        ? (event.shiftKey ? controls.length - 1 : 0)
        : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      controls[next].focus()
    }

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus({ preventScroll: true })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [session, onClose])

  if (!session) return null

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/60 p-4 sm:items-center"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="session-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto border border-gold/30 bg-ivory shadow-soft animate-fade-up"
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
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center border border-navy/15 text-xl text-navy transition hover:border-gold hover:text-gold-dark"
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
