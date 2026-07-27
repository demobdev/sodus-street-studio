import { Link } from 'react-router-dom'
import { addOns, services } from '../content/services'
import { site } from '../content/site'

export function Services() {
  return (
    <>
      <section className="bg-navy px-5 py-20 text-ivory md:px-8 lg:px-12">
        <div className="container-site">
          <p className="section-label text-gold-light">Services</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
            Recording, Production, and Creative Support in Clyde, NY
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory/75">
            From podcasts and voiceovers to music, content production, and studio
            rental, Sodus Street Studio gives creators the space, tools, and
            guidance to bring ideas to life.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site grid gap-8">
          {services.map((service) => (
            <article
              key={service.id}
              id={service.id}
              className="grid gap-4 border-b border-navy/10 pb-8 md:grid-cols-[240px_1fr]"
            >
              <h2 className="font-display text-3xl text-navy">{service.title}</h2>
              <div>
                <p className="text-lg leading-relaxed text-navy-muted">
                  {service.description}
                </p>
                <Link to="/booking" className="mt-4 inline-block text-sm font-semibold uppercase tracking-[0.14em] text-gold-dark hover:text-gold">
                  Book this session →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad bg-ivory-warm">
        <div className="container-site">
          <p className="section-label">Optional Add-Ons</p>
          <h2 className="display-title mt-3">Extra Support When You Need It</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {addOns.map((item) => (
              <li key={item} className="border border-navy/10 bg-white px-5 py-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="rates" className="section-pad">
        <div className="container-site">
          <p className="section-label">Rates</p>
          <h2 className="display-title mt-3">Transparent Studio Pricing</h2>
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
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/booking" className="btn-primary">Book a Session</Link>
            <Link to="/contact" className="btn-outline">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  )
}
