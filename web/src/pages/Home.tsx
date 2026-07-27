import { Link } from 'react-router-dom'
import { Accordion } from '../components/Accordion'
import { faqPreview } from '../content/faq'
import { services } from '../content/services'
import { site } from '../content/site'

const quickActions = [
  {
    title: 'Book a Session',
    copy: 'Reserve studio time for your next project.',
    href: '/booking',
  },
  {
    title: 'Explore Services',
    copy: 'See podcast, voiceover, music, production, and rental options.',
    href: '/services',
  },
  {
    title: 'View Rates',
    copy: 'Review hourly and full-day pricing.',
    href: '/#rates',
  },
  {
    title: 'Contact Us',
    copy: 'Not sure what to book? Ask a question.',
    href: '/contact',
  },
]

export function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[88vh] overflow-hidden bg-navy text-ivory">
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(184,149,74,0.22),transparent_45%),radial-gradient(ellipse_at_80%_70%,rgba(21,34,56,0.9),#0B1628)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(248,245,239,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(248,245,239,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />
        <div className="relative container-site flex min-h-[88vh] flex-col justify-center px-5 py-24 md:px-8 lg:px-12">
          <p className="animate-fade-up section-label text-gold-light">
            {site.location}
          </p>
          <h1 className="animate-fade-up-delay mt-4 max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ivory md:text-7xl">
            {site.tagline}
          </h1>
          <p className="animate-fade-up-delay-2 mt-6 max-w-2xl text-lg leading-relaxed text-ivory/80 md:text-xl">
            {site.subheadline}
          </p>
          <div className="animate-fade-up-delay-2 mt-10 flex flex-wrap gap-4">
            <Link to="/booking" className="btn-primary">
              Book a Session
            </Link>
            <Link to="/services" className="btn-secondary">
              Explore Services
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Action Bar */}
      <section className="border-b border-navy/10 bg-ivory-warm">
        <div className="container-site grid gap-px bg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.href}
              className="group bg-ivory-warm px-6 py-8 transition hover:bg-ivory"
            >
              <h2 className="font-display text-2xl text-navy transition group-hover:text-gold-dark">
                {action.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-navy-muted">
                {action.copy}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* About Preview */}
      <section className="section-pad">
        <div className="container-site grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="section-label">About Sodus Street Studio</p>
            <h2 className="display-title mt-3">
              Built for Local Creators. Designed for Big Ideas.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-navy-muted">
              Sodus Street Studio is a warm, professional creative facility where
              artists, storytellers, musicians, podcasters, and entrepreneurs can
              bring their ideas to life. Located in the heart of Clyde, NY, the
              studio offers high-quality recording services in a space designed to
              inspire, support, and elevate every project.
            </p>
            <Link to="/about" className="btn-outline mt-8">
              Learn About the Studio
            </Link>
          </div>
          <div className="relative min-h-[320px] overflow-hidden bg-navy">
            <img
              src="/images/mock-studio-room.png"
              alt="Sodus Street Studio recording room mockup"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/25 to-transparent" />
            <div className="relative flex h-full min-h-[320px] flex-col justify-end p-8 text-ivory">
              <p className="font-display text-3xl text-gold-light">Clyde, NY</p>
              <p className="mt-2 text-ivory/85">
                A modern creative space rooted in a historic Main Street community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section className="section-pad bg-navy text-ivory">
        <div className="container-site">
          <p className="section-label text-gold-light">Services</p>
          <h2 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            Recording, Production, and Creative Support
          </h2>
          <p className="mt-5 max-w-3xl text-lg text-ivory/75">
            Whether you are starting a podcast, recording a voiceover, producing
            music, or creating content for your business, Sodus Street Studio gives
            you the space, tools, and support to bring your project to life.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Link
                key={service.id}
                to="/services"
                className="border border-ivory/15 p-6 transition duration-300 hover:border-gold hover:bg-navy-soft"
              >
                <h3 className="font-display text-2xl text-gold-light">
                  {service.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ivory/70">
                  {service.description}
                </p>
              </Link>
            ))}
          </div>
          <Link to="/services" className="btn-primary mt-10">
            Explore All Services
          </Link>
        </div>
      </section>

      {/* Rates */}
      <section id="rates" className="section-pad">
        <div className="container-site">
          <p className="section-label">Rates</p>
          <h2 className="display-title mt-3">Simple Studio Pricing</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="border border-navy/10 bg-white p-8 shadow-soft">
              <h3 className="font-display text-3xl text-navy">
                {site.rates.hourly.label}
              </h3>
              <p className="mt-4 font-display text-5xl text-gold-dark">
                {site.rates.hourly.price}
                <span className="ml-2 text-2xl text-navy-muted">
                  {site.rates.hourly.unit}
                </span>
              </p>
              <ul className="mt-6 space-y-2 text-navy-muted">
                <li>Podcast recording</li>
                <li>Voiceover recording</li>
                <li>Short music sessions</li>
                <li>Editing support</li>
                <li>Creative consulting</li>
              </ul>
              <Link to="/booking" className="btn-primary mt-8">
                Book Hourly
              </Link>
            </div>
            <div className="border border-gold/40 bg-navy p-8 text-ivory shadow-soft">
              <h3 className="font-display text-3xl">
                {site.rates.fullDay.label}
              </h3>
              <p className="mt-4 font-display text-5xl text-gold-light">
                {site.rates.fullDay.price}
                <span className="ml-2 text-2xl text-ivory/60">
                  {site.rates.fullDay.unit}
                </span>
              </p>
              <ul className="mt-6 space-y-2 text-ivory/75">
                <li>Full production days</li>
                <li>Multi-episode podcast recording</li>
                <li>Music projects</li>
                <li>Content batching</li>
                <li>Longer studio rentals</li>
              </ul>
              <Link to="/booking" className="btn-primary mt-8">
                Book Full Day
              </Link>
            </div>
          </div>
          <p className="mt-6 text-sm text-navy-muted">{site.rates.paymentNote}</p>
          <p className="mt-2 text-sm text-navy-muted">{site.rates.cancellation}</p>
        </div>
      </section>

      {/* Studio Space Preview */}
      <section className="section-pad bg-ivory-warm">
        <div className="container-site grid items-center gap-12 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Room', src: '/images/mock-studio-room.png', wide: true },
              { label: 'Mic Setup', src: '/images/mock-microphone.png', wide: false },
              { label: 'Control', src: '/images/mock-control.png', wide: false },
              { label: 'Lounge', src: '/images/mock-lounge.png', wide: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`relative overflow-hidden bg-navy ${item.wide ? 'col-span-2 min-h-48 md:min-h-56' : 'min-h-36 md:min-h-40'}`}
              >
                <img
                  src={item.src}
                  alt={`${item.label} mock studio photo`}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-3 text-xs uppercase tracking-[0.18em] text-ivory/90">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="section-label">Studio Space</p>
            <h2 className="display-title mt-3">
              A Creative Space Built for Focus, Comfort, and Quality
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-navy-muted">
              Sodus Street Studio blends Clyde’s historic character with a modern,
              intentionally designed creative environment. The space is warm,
              comfortable, and built to support creators at every level.
            </p>
            <ul className="mt-6 space-y-2 text-navy-muted">
              <li>Podcast and voiceover recording setup</li>
              <li>Audio production environment</li>
              <li>Professional recording equipment</li>
              <li>Acoustic treatment</li>
              <li>Engineer guidance</li>
            </ul>
            <Link to="/studio-space" className="btn-outline mt-8">
              View Studio Space
            </Link>
          </div>
        </div>
      </section>

      {/* Booking CTA */}
      <section className="bg-navy px-5 py-20 text-center text-ivory md:px-8">
        <div className="container-site">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold md:text-5xl">
            Ready to Record, Create, or Bring Your Idea to Life?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ivory/75">
            Book a session at Sodus Street Studio and we’ll help guide the process
            from first take to final project.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/booking" className="btn-primary">
              Book a Session
            </Link>
            <Link to="/contact" className="btn-secondary">
              Not Sure What to Book? Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Portfolio Preview */}
      <section className="section-pad">
        <div className="container-site">
          <p className="section-label">Portfolio / Samples</p>
          <h2 className="display-title mt-3">
            Hear What’s Possible at Sodus Street Studio
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-navy-muted">
            Portfolio samples coming soon. We’ll be adding audio clips, podcast
            samples, voiceover demos, and project highlights as new work becomes
            available.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/portfolio" className="btn-outline">
              Listen to Samples
            </Link>
            <Link to="/booking" className="btn-primary">
              Book a Session
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="section-pad bg-ivory-warm">
        <div className="container-site">
          <p className="section-label">FAQ</p>
          <h2 className="display-title mt-3">Questions Before You Book?</h2>
          <div className="mt-10">
            <Accordion items={faqPreview} />
          </div>
          <Link to="/faq" className="btn-outline mt-8">
            View All FAQs
          </Link>
        </div>
      </section>

      {/* Contact Preview */}
      <section className="section-pad">
        <div className="container-site grid gap-10 lg:grid-cols-2">
          <div>
            <p className="section-label">Contact</p>
            <h2 className="display-title mt-3">
              Not Sure Where to Start? We’ll Help You Choose.
            </h2>
            <p className="mt-5 text-lg text-navy-muted">
              Have a question before booking? Reach out and we’ll help you choose
              the right session for your project.
            </p>
            <div className="mt-6 text-navy">
              <p className="font-semibold">{site.name}</p>
              <p>{site.address.line1}</p>
              <p>{site.address.line2}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/contact" className="btn-primary">
                Contact Us
              </Link>
              <Link to="/booking" className="btn-outline">
                Book a Session
              </Link>
            </div>
          </div>
          <div className="relative min-h-[280px] overflow-hidden border border-navy/10 bg-navy">
            <img
              src="/images/mock-podcast-setup.png"
              alt="Sodus Street Studio podcast setup"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-transparent" />
            <div className="relative flex h-full min-h-[280px] flex-col items-start justify-end p-8 text-ivory">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-light">
                Map embed coming soon
              </p>
              <p className="mt-2 font-display text-3xl">28 Sodus Street</p>
              <p className="text-ivory/80">Clyde, NY 14433</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
