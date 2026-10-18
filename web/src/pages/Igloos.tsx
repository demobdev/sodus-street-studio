import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ContactForm } from '../components/ContactForm'
import { IglooBookingFlow } from '../components/IglooBookingFlow'
import { IglooPromoVideo } from '../components/IglooPromoVideo'
import { iglooEvent } from '../content/igloo-event'
import { site } from '../content/site'
import { errorMessage, iglooApi } from '../lib/igloo'
import type { IglooCatalog } from '../lib/igloo'

export function Igloos() {
  const { hash } = useLocation()
  const [catalog, setCatalog] = useState<IglooCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bookingOpen = catalog?.bookingOpen && catalog.mode !== 'unconfigured'

  useEffect(() => {
    if (hash !== '#igloo-video') return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('igloo-video')?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hash])

  useEffect(() => {
    const controller = new AbortController()
    void iglooApi<IglooCatalog>('/catalog', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setCatalog(result) })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  async function refreshCatalog() {
    const result = await iglooApi<IglooCatalog>('/catalog')
    setCatalog(result)
    setError('')
  }

  return (
    <>
      <section className="section-pad border-b border-gold/30 bg-navy text-ivory">
        <div className="container-site grid items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <div>
            <p className="section-label text-gold-light">Sodus Street Studio · October 2026</p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Under the stars.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/80">
              Your own igloo, your favorite people, and a platter to share.
              Gather for an autumn evening at Sodus Street Studio in Clyde.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <a href={bookingOpen ? '#igloo-booking' : '#igloo-inquiry'} className="btn-primary">
                {bookingOpen ? catalog?.mode === 'test' ? 'Explore Test Bookings' : 'Find Your Evening' : 'Ask About the Igloos'}
              </a>
              <a href="#igloo-video" className="text-sm font-semibold text-ivory underline decoration-gold underline-offset-4 hover:text-gold-light">Watch the Clyde video ↓</a>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ivory/65">
              {loading ? 'Checking online booking availability…' : error
                ? 'We can’t check online booking right now. Send an inquiry and we’ll help you plan your visit.'
                : bookingOpen
                ? catalog?.mode === 'test'
                  ? 'Booking preview only. No live reservation is offered here.'
                  : 'Choose an available evening below and review the booking policy before checkout.'
                : 'Online reservations are not open yet. Send an inquiry to plan your visit.'}
            </p>
          </div>
          <div className="border border-gold/40 bg-ivory/[0.03] p-7 md:p-9">
            <p className="section-label text-gold-light">Your evening, together</p>
            <p className="mt-5 font-display text-6xl text-ivory">${iglooEvent.priceCents / 100}<span className="ml-2 text-2xl text-ivory/70">per igloo</span></p>
            <p className="mt-2 text-sm text-ivory/65">Plus 8% tax · $243 total</p>
            <ul className="mt-7 space-y-3 border-t border-gold/30 pt-6 text-ivory/85">
              <li>Up to {iglooEvent.maxGuests} guests</li>
              <li>{iglooEvent.durationMinutes} minutes in your own igloo</li>
              <li>One platter included · four choices</li>
            </ul>
            <p className="mt-7 text-sm leading-relaxed text-ivory/65">
              {site.address.line1}<br />{site.address.line2}
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad border-b border-navy/10 bg-ivory-warm" aria-labelledby="igloo-photos-title">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <h2 id="igloo-photos-title" className="display-title max-w-lg">A first look at the igloos.</h2>
            <p className="max-w-md leading-relaxed text-navy-muted">
              An early look at the space at Sodus Street Studio.
              Furnishings and final table settings are being prepared.
            </p>
          </div>
          <div className="mt-9 grid gap-6 md:grid-cols-2">
            <figure>
              <img
                src="/images/igloos-evening.jpg"
                alt="Clear igloos lit with warm string lights, with pumpkins and autumn flowers beside the entrances."
                width={1536}
                height={1152}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
              <figcaption className="mt-3 text-sm text-navy-muted">The igloos after sunset.</figcaption>
            </figure>
            <figure>
              <img
                src="/images/igloo-entrance.jpg"
                alt="An unfurnished igloo entrance framed by cornstalks, pumpkins, flowers and warm lights."
                width={1536}
                height={1152}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
              <figcaption className="mt-3 text-sm text-navy-muted">A closer look at the autumn setting.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <IglooPromoVideo />

      <section className="section-pad" aria-labelledby="igloo-dates-title">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="section-label">Four October evenings</p>
              <h2 id="igloo-dates-title" className="display-title mt-3">Choose your night.</h2>
            </div>
            <p className="max-w-sm leading-relaxed text-navy-muted">Three seatings each evening. {iglooEvent.capacityPerSeating} igloos per seating.</p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {iglooEvent.dates.map(date => (
              <div key={date.date} className="border border-navy/15 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">October 2026</p>
                <p className="mt-3 font-display text-5xl text-navy" aria-hidden="true">{date.day}</p>
                <time dateTime={date.date} className="mt-3 block text-sm text-navy-muted">{date.label}</time>
                {date.note ? <p className="mt-3 text-sm font-semibold text-gold-dark">{date.note}</p> : null}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-navy/10 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <p className="text-sm font-semibold text-navy">Evening seatings</p>
            {iglooEvent.seatings.map(seating => <p key={seating.start} className="text-sm text-navy-muted">{seating.label}</p>)}
            <p className="text-xs text-navy-muted">All times Eastern</p>
          </div>
        </div>
      </section>

      <section className="section-pad border-y border-navy/10 bg-ivory-warm" aria-labelledby="igloo-platters-title">
        <div className="container-site">
          <p className="section-label">Made to share</p>
          <h2 id="igloo-platters-title" className="display-title mt-3">A platter for your table.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-muted">Choose one of four platters, included with your igloo booking.</p>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            {iglooEvent.platters.map((platter, index) => (
              <article key={platter.id} className="border border-navy/10 bg-ivory p-6 md:p-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-gold-dark" aria-hidden="true">0{index + 1}</p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-navy md:text-3xl">{platter.name}</h3>
                <p className="mt-3 leading-relaxed text-navy-muted">{platter.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad border-b border-navy/10" aria-labelledby="igloo-booking-terms-title">
        <div className="container-site grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="section-label">Before you book</p>
            <h2 id="igloo-booking-terms-title" className="display-title mt-3">Plan with confidence.</h2>
          </div>
          <div className="space-y-5 leading-relaxed text-navy-muted">
            <p>Full payment of $243, including 8% tax, is due at booking. New reservations close at 2pm Eastern on the event day. An already-started checkout can be completed within its payment window.</p>
            <p>Customer cancellations, refunds, rescheduling and exchanges are not available. If you cannot attend, you may give your ticket to a friend or family member.</p>
            <p>If Sodus Street Studio closes for weather or unforeseen circumstances, you will receive a full refund.</p>
          </div>
        </div>
      </section>

      {loading ? <p role="status" className="container-site px-5 py-8 text-sm text-navy-muted">Checking booking availability…</p> : null}
      {bookingOpen && catalog ? <IglooBookingFlow catalog={catalog} onRefresh={refreshCatalog} /> : !loading ? (
      <section id="igloo-inquiry" className="section-pad scroll-mt-28">
        <div className="container-site grid gap-10 lg:grid-cols-[0.85fr_1.3fr] lg:gap-20">
          <div>
            <p className="section-label">Plan an evening</p>
            <h2 className="display-title mt-3">Plan your gathering.</h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-navy-muted">
              Tell us your preferred evening, group size, and platter choice.
              Our team can answer questions while online reservations are being prepared.
            </p>
            {error ? <div className="mt-5 text-sm text-navy-muted"><p>We can’t check booking availability right now. You can still send an inquiry below.</p><button type="button" className="mt-2 font-semibold underline decoration-gold underline-offset-4" onClick={() => { void refreshCatalog().catch(cause => setError(errorMessage(cause))) }}>Try Again</button></div> : null}
            {!error && catalog?.notice ? <p className="mt-5 text-sm text-navy-muted">{catalog.notice}</p> : null}
            <div className="mt-8 border-t border-navy/15 pt-6">
              <p className="text-sm text-navy-muted">Looking for studio recording time?</p>
              <Link to="/booking" className="mt-3 inline-block font-semibold text-navy underline decoration-gold underline-offset-4 hover:text-gold-dark">
                Explore studio sessions →
              </Link>
            </div>
          </div>
          <ContactForm inquiryType="igloo" />
        </div>
      </section>
      ) : null}
    </>
  )
}
