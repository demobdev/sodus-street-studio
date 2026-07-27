import { Link } from 'react-router-dom'
import { services } from '../content/services'
import { site } from '../content/site'

export function Footer() {
  return (
    <footer className="border-t border-gold/30 bg-navy text-ivory">
      <div className="container-site section-pad grid gap-10 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <img
            src="/logo-light.png"
            alt="Sodus Street Studio"
            className="mb-4 h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[220px]"
          />
          <p className="font-display text-2xl text-gold-light">{site.tagline}</p>
          <p className="mt-3 text-sm text-ivory/70">
            {site.address.line1}
            <br />
            {site.address.line2}
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Studio
          </h3>
          <ul className="space-y-2 text-sm text-ivory/80">
            <li><Link to="/about" className="hover:text-gold">About</Link></li>
            <li><Link to="/studio-space" className="hover:text-gold">Studio Space</Link></li>
            <li><Link to="/portfolio" className="hover:text-gold">Portfolio</Link></li>
            <li><Link to="/contact" className="hover:text-gold">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Services
          </h3>
          <ul className="space-y-2 text-sm text-ivory/80">
            {services.slice(0, 6).map((service) => (
              <li key={service.id}>
                <Link to="/services" className="hover:text-gold">
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Booking
          </h3>
          <ul className="space-y-2 text-sm text-ivory/80">
            <li><Link to="/booking" className="hover:text-gold">Book a Session</Link></li>
            <li><Link to="/booking#rates" className="hover:text-gold">Rates</Link></li>
            <li><Link to="/booking#policies" className="hover:text-gold">Cancellation Policy</Link></li>
            <li><Link to="/studio-space#rules" className="hover:text-gold">Studio Rules</Link></li>
            <li><Link to="/faq" className="hover:text-gold">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Visit & Legal
          </h3>
          <ul className="space-y-2 text-sm text-ivory/80">
            <li><Link to="/contact" className="hover:text-gold">Contact</Link></li>
            <li><Link to="/privacy-policy" className="hover:text-gold">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions" className="hover:text-gold">Terms & Conditions</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ivory/10 px-5 py-5 text-center text-xs text-ivory/50 md:px-8">
        © {new Date().getFullYear()} Sodus Street Studio. All rights reserved.
      </div>
    </footer>
  )
}
