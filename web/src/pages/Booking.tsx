import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookingForm } from '../components/BookingForm'
import { PageHero } from '../components/PageHero'
import { SessionTypeModal } from '../components/SessionTypeModal'
import { sessions, type SessionType } from '../content/sessions'
import { site } from '../content/site'

export function Booking() {
  const [activeSession, setActiveSession] = useState<SessionType | null>(null)
  const [selectedSession, setSelectedSession] = useState('')

  function handleBook(sessionTitle: string) {
    setSelectedSession(sessionTitle)
    setActiveSession(null)
    document.getElementById('booking-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <>
      <PageHero
        label="Booking"
        title="Book Your Session at Sodus Street Studio"
        description="Choose your session type, reserve your time, and bring your next creative project to life."
        image="/images/page-hero-booking.png"
      />

      <section className="section-pad">
        <div className="container-site">
          <p className="section-label">Session Types</p>
          <h2 className="display-title mt-3">What Are You Creating?</h2>
          <p className="mt-4 max-w-2xl text-navy-muted">
            Select a session to see rates, duration options, and what to expect—then
            jump straight into the booking form.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSession(session)}
                className="border border-navy/10 bg-white px-5 py-5 text-left transition duration-300 hover:border-gold hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-gold/40"
              >
                <span className="block font-medium text-navy">{session.title}</span>
                <span className="mt-2 block text-sm text-navy-muted">
                  {session.summary}
                </span>
                <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-gold-dark">
                  View details →
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="rates" className="section-pad bg-ivory-warm">
        <div className="container-site">
          <p className="section-label">Rates</p>
          <h2 className="display-title mt-3">Simple Studio Pricing</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="border border-navy/10 bg-white p-8">
              <h3 className="font-display text-3xl">{site.rates.hourly.label}</h3>
              <p className="mt-3 font-display text-5xl text-gold-dark">
                {site.rates.hourly.price}
                <span className="ml-2 text-xl text-navy-muted">{site.rates.hourly.unit}</span>
              </p>
            </div>
            <div className="border border-gold/40 bg-navy p-8 text-ivory">
              <h3 className="font-display text-3xl">{site.rates.fullDay.label}</h3>
              <p className="mt-3 font-display text-5xl text-gold-light">
                {site.rates.fullDay.price}
                <span className="ml-2 text-xl text-ivory/60">{site.rates.fullDay.unit}</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-navy-muted">{site.rates.paymentNote}</p>
        </div>
      </section>

      <section id="booking-form" className="section-pad scroll-mt-28">
        <div className="container-site max-w-3xl">
          <p className="section-label">Request a Session</p>
          <h2 className="display-title mt-3">Tell Us About Your Project</h2>
          {selectedSession ? (
            <p className="mt-3 text-sm text-gold-dark">
              Selected session: <span className="font-semibold">{selectedSession}</span>
            </p>
          ) : null}
          <div className="mt-8">
            <BookingForm selectedSession={selectedSession} />
          </div>
        </div>
      </section>

      <section id="policies" className="section-pad bg-navy text-ivory">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <p className="section-label text-gold-light">Payment Information</p>
            <h2 className="mt-3 font-display text-4xl">Pay When You Book</h2>
            <p className="mt-5 text-ivory/75">
              Payment is due upon booking. At launch, Acuity Scheduling will handle
              calendar availability, payments, confirmations, and reminders.
            </p>
          </div>
          <div>
            <p className="section-label text-gold-light">Cancellation Policy</p>
            <h2 className="mt-3 font-display text-4xl">24-Hour Notice</h2>
            <p className="mt-5 text-ivory/75">{site.rates.cancellation}</p>
          </div>
        </div>
        <div className="container-site mt-12">
          <p className="section-label text-gold-light">Studio Rules</p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {site.studioRules.map((rule) => (
              <li key={rule} className="border border-ivory/15 px-5 py-4 text-ivory/80">
                {rule}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/faq" className="btn-primary">Read FAQ</Link>
            <Link to="/contact" className="btn-secondary">Ask a Question</Link>
          </div>
        </div>
      </section>

      <SessionTypeModal
        session={activeSession}
        onClose={() => setActiveSession(null)}
        onBook={handleBook}
      />
    </>
  )
}
