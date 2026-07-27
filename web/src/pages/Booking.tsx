import { Link } from 'react-router-dom'
import { BookingForm } from '../components/BookingForm'
import { sessionTypes, site } from '../content/site'

export function Booking() {
  return (
    <>
      <section className="bg-navy px-5 py-20 text-ivory md:px-8 lg:px-12">
        <div className="container-site">
          <p className="section-label text-gold-light">Booking</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
            Book Your Session at Sodus Street Studio
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory/75">
            Choose your session type, reserve your time, and bring your next
            creative project to life.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site">
          <p className="section-label">Session Types</p>
          <h2 className="display-title mt-3">What Are You Creating?</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessionTypes.map((type) => (
              <div key={type} className="border border-navy/10 bg-white px-5 py-4">
                {type}
              </div>
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

      <section className="section-pad">
        <div className="container-site max-w-3xl">
          <p className="section-label">Request a Session</p>
          <h2 className="display-title mt-3">Tell Us About Your Project</h2>
          <div className="mt-8">
            <BookingForm />
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
    </>
  )
}
