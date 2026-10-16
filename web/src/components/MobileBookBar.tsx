import { Link, useLocation } from 'react-router-dom'

export function MobileBookBar() {
  const iglooPage = useLocation().pathname.startsWith('/igloos')
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-ivory/95 p-3 backdrop-blur sm:hidden">
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold uppercase tracking-wider">
        <Link to={iglooPage ? '/igloos' : '/booking'} className="rounded-sm bg-gold px-2 py-3 text-navy">
          {iglooPage ? 'Igloos' : 'Book'}
        </Link>
        <Link to={iglooPage ? '/booking' : '/services'} className="rounded-sm border border-navy/15 px-2 py-3 text-navy">
          {iglooPage ? 'Studio' : 'Services'}
        </Link>
        <Link to="/contact" className="rounded-sm border border-navy/15 px-2 py-3 text-navy">
          Contact
        </Link>
      </div>
    </div>
  )
}
