import { Link, useLocation } from 'react-router-dom'
import { iglooReservationUrl } from '../content/igloo-content'

export function MobileBookBar() {
  const { pathname } = useLocation()
  const iglooPage = pathname.startsWith('/igloos')
  const iglooLanding = iglooPage || pathname === '/'
  return (
    <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-ivory/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-wider">
        {iglooLanding ? (
          <a href={iglooReservationUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm bg-gold px-2 py-3 text-navy">
            Reserve <span className="sr-only">(opens Eventbrite in a new tab)</span>
          </a>
        ) : (
          <Link to="/booking" className="rounded-sm bg-gold px-2 py-3 text-navy">
            Book
          </Link>
        )}
        <Link to={iglooPage ? '/booking' : '/services'} className="rounded-sm border border-navy/15 px-2 py-3 text-navy">
          {iglooPage ? 'Studio' : 'Services'}
        </Link>
        <Link to="/contact" className="rounded-sm border border-navy/15 px-2 py-3 text-navy">
          Contact
        </Link>
      </div>
    </nav>
  )
}
