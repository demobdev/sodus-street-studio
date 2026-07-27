import { Link } from 'react-router-dom'
import { ContactForm } from '../components/ContactForm'
import { site } from '../content/site'

export function Contact() {
  return (
    <>
      <section className="bg-navy px-5 py-20 text-ivory md:px-8 lg:px-12">
        <div className="container-site">
          <p className="section-label text-gold-light">Contact</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-semibold md:text-6xl">
            Contact Sodus Street Studio
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory/75">
            Have a question before booking? Reach out and we’ll help you choose
            the right session for your project.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <p className="section-label">Send a Message</p>
            <h2 className="display-title mt-3">We’re Happy to Help</h2>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
          <div>
            <p className="section-label">Studio Information</p>
            <h2 className="display-title mt-3">{site.name}</h2>
            <p className="mt-4 text-lg text-navy-muted">
              {site.address.line1}
              <br />
              {site.address.line2}
            </p>
            <p className="mt-4 text-sm text-navy-muted">
              Phone, email, and business hours will be listed here once confirmed.
            </p>
            <div className="relative mt-8 min-h-[240px] overflow-hidden border border-navy/10 bg-navy">
              <img
                src="/images/mock-lounge.png"
                alt="Sodus Street Studio space"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/35 to-transparent" />
              <div className="relative flex h-full min-h-[240px] flex-col justify-end p-6 text-ivory">
                <p className="text-xs uppercase tracking-[0.18em] text-gold-light">
                  Map embed coming soon
                </p>
                <p className="mt-2 font-display text-3xl">Clyde, NY</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/booking" className="btn-primary">Book a Session</Link>
              <Link to="/services" className="btn-outline">Explore Services</Link>
              <Link to="/studio-space" className="btn-outline">View Studio Space</Link>
              <Link to="/faq" className="btn-outline">FAQ</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
