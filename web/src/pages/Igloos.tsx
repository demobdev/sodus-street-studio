import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IglooGallery } from '../components/IglooGallery'
import { IglooPromoVideo } from '../components/IglooPromoVideo'
import { iglooReservationUrl } from '../content/igloo-content'
import { site } from '../content/site'

export function Igloos() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash !== '#igloo-video') return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('igloo-video')?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hash])

  return (
    <>
      <section className="relative isolate min-h-[76vh] overflow-hidden bg-navy text-ivory">
        <img
          src="/images/igloo-hero.jpg"
          alt="Four illuminated igloos beneath string lights on an autumn evening."
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/60 to-navy/20" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-navy/20" aria-hidden="true" />
        <div className="container-site relative z-[1] flex min-h-[76vh] flex-col justify-center px-5 py-24 md:px-8 lg:px-12">
          <p className="section-label text-gold-light">Sodus Street Studio · Clyde, NY</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Gather under the stars.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ivory/85 md:text-xl">
            Settle into an illuminated igloo for outdoor dining with your favorite people. Igloos and outdoor dining continue through November, with Sport Saturdays as part of the season.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={iglooReservationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Reserve Now <span className="sr-only">(opens Eventbrite in a new tab)</span>
            </a>
            <a href="#igloo-gallery" className="btn-secondary">Explore the photos</a>
          </div>
          <a href="#igloo-video" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-ivory underline decoration-gold underline-offset-4 hover:text-gold-light">
            Watch the 10-second igloo video ↓
          </a>
        </div>
      </section>

      <IglooGallery />

      <section className="section-pad border-b border-navy/10" aria-labelledby="igloo-season-title">
        <div className="container-site grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="section-label">Through November · Clyde, NY</p>
            <h2 id="igloo-season-title" className="display-title mt-3">
              Outdoor dining, under the lights.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-muted">
              The season brings together private igloos, outdoor dining, and the Sport Saturdays concept. Visit the Eventbrite listing for the event details.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 border-l-2 border-gold pl-6">
            <p className="text-sm leading-relaxed text-navy-muted">
              {site.address.line1}<br />{site.address.line2}
            </p>
            <a href={iglooReservationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Reserve Now <span className="sr-only">(opens Eventbrite in a new tab)</span>
            </a>
          </div>
        </div>
      </section>

      <IglooPromoVideo />

      <section className="section-pad border-b border-navy/10 bg-ivory-warm" aria-labelledby="igloo-booking-terms-title">
        <div className="container-site grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="section-label">Before you book</p>
            <h2 id="igloo-booking-terms-title" className="display-title mt-3">Plan with confidence.</h2>
          </div>
          <div className="space-y-5 leading-relaxed text-navy-muted">
            <p>Full payment is due at booking: $225 per igloo plus $18 tax ($243 before any Eventbrite fees). Eventbrite shows final availability and total. New reservations close at 2pm Eastern on the event day. An already-started checkout can be completed within its payment window.</p>
            <p>Customer cancellations, refunds, rescheduling and exchanges are not available. If you cannot attend, you may give your ticket to a friend or family member.</p>
            <p>If Sodus Street Studio closes for weather or unforeseen circumstances, you will receive a full refund.</p>
          </div>
        </div>
      </section>

      <section className="section-pad" aria-labelledby="igloo-contact-title">
        <div className="container-site flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="section-label">Questions?</p>
            <h2 id="igloo-contact-title" className="display-title mt-3">We’re happy to help.</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-navy-muted">
              For questions about the event or your reservation, contact Sodus Street Studio.
            </p>
          </div>
          <Link to="/contact" className="btn-outline">Contact the studio</Link>
        </div>
      </section>

      <section className="border-t border-navy/10 bg-ivory-warm px-5 py-10 md:px-8" aria-labelledby="studio-coming-soon-title">
        <div className="container-site flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="section-label">Studio updates</p>
            <h2 id="studio-coming-soon-title" className="mt-2 font-display text-3xl font-semibold text-navy">
              Studio offerings are coming soon.
            </h2>
          </div>
          <Link to="/studio-space" className="btn-outline">Explore the studio</Link>
        </div>
      </section>
    </>
  )
}
