import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IglooPackageEditor, IglooSlotEditor } from '../components/IglooAdminForms'
import { IglooApiError, errorMessage, eventDate, eventTime, iglooApi, isLocalBookingHost, money } from '../lib/igloo'
import type { IglooAdminData, IglooPackage, IglooSlot } from '../lib/igloo'

function loginToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get('login') || ''
}

function safeLocalLogin(value?: string) {
  if (!value || !isLocalBookingHost()) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && url.pathname === '/igloos/manage' ? url.href : null
  } catch { return null }
}

export default function IglooManage() {
  const [token, setToken] = useState(loginToken)
  const [data, setData] = useState<IglooAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [localLogin, setLocalLogin] = useState<string | null>(null)
  const [view, setView] = useState<'bookings' | 'packages' | 'times'>('bookings')
  const [packageEditor, setPackageEditor] = useState<IglooPackage | 'new' | null>(null)
  const [slotEditor, setSlotEditor] = useState<IglooSlot | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const initialRequest = useRef<Promise<IglooAdminData> | null>(null)

  useEffect(() => {
    let active = true
    if (token) window.history.replaceState(null, '', window.location.pathname)
    if (!initialRequest.current) {
      initialRequest.current = (async () => {
        if (token) await iglooApi('/admin/session', { body: { token } })
        return iglooApi<IglooAdminData>('/admin')
      })()
    }
    void initialRequest.current.then(result => { if (active) setData(result) }).catch(cause => {
      if (active && (!(cause instanceof IglooApiError) || cause.status !== 401)) setError(errorMessage(cause))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function refresh() {
    try { setData(await iglooApi<IglooAdminData>('/admin')) }
    catch (cause) { if (cause instanceof IglooApiError && cause.status === 401) setData(null); throw cause }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') || '').trim()
    setBusy(true); setError(''); setNotice(''); setLocalLogin(null)
    try {
      const result = await iglooApi<{ ok: true; devLoginUrl?: string }>('/admin/login', { body: { email } })
      const localLink = safeLocalLogin(result.devLoginUrl)
      setNotice(localLink ? 'Local sign-in is ready. No email was sent.' : 'If this email has access, a sign-in link is on its way. Check your inbox.')
      setLocalLogin(localLink)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('')
    try { await task(); setNotice(success) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  const bookings = data?.bookings.filter(booking => `${booking.reference} ${booking.name} ${booking.email} ${booking.status}`.toLowerCase().includes(search.trim().toLowerCase())) || []

  return (
    <section className="section-pad">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="section-label">Sodus Street Studio</p><h1 className="display-title mt-3">Igloo bookings</h1><p className="mt-3 text-navy-muted">Manage packages, event times, and reservations.</p></div>
          <Link to="/igloos" className="btn-outline">View Booking Page</Link>
        </div>
        {loading ? <p role="status" className="mt-10">Checking your access…</p> : !data ? (
          <div className="mt-10 max-w-xl border border-navy/15 bg-white p-6 sm:p-8">
            <h2 className="font-display text-3xl">Sign in to manage bookings.</h2><p className="mt-3 text-sm leading-relaxed text-navy-muted">Use your approved staff email. We’ll send a one-time sign-in link.</p>
            <form onSubmit={signIn} className="mt-6 space-y-4"><label className="block text-sm"><span className="mb-1.5 block font-medium">Staff email</span><input name="email" type="email" autoComplete="email" required className="input-field" /></label><button className="btn-primary disabled:opacity-60" disabled={busy}>{busy ? 'Sending…' : 'Send Sign-In Link'}</button></form>
            {localLogin ? <div className="mt-6 border border-gold bg-ivory-warm p-4 text-sm"><p>No email was sent by the local simulator.</p><a href={localLogin} onClick={event => { event.preventDefault(); initialRequest.current = null; setLoading(true); setError(''); setNotice(''); setToken(new URLSearchParams(new URL(localLogin).hash.slice(1)).get('login') || '') }} className="mt-3 inline-block font-semibold underline decoration-gold underline-offset-4">Local test sign-in</a></div> : null}
          </div>
        ) : (
          <>
            {data.mode === 'test' ? <div role="note" className="mt-8 border border-gold bg-ivory-warm px-5 py-4 text-sm"><strong>Test mode.</strong> These are test bookings. Editing this dashboard does not enable live payments.</div> : null}
            {data.readiness.length ? <details className="mt-5 border border-navy/15 bg-white p-5" open><summary className="cursor-pointer font-semibold">Setup status</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-navy-muted">{data.readiness.map(item => <li key={item}>{item}</li>)}</ul></details> : null}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-navy/15 pb-5">
              <div className="flex flex-wrap gap-2" aria-label="Booking management views">{(['bookings', 'packages', 'times'] as const).map(item => <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)} className={`px-4 py-3 text-sm font-semibold transition ${view === item ? 'bg-navy text-ivory' : 'border border-navy/15 hover:border-gold'}`}>{item === 'bookings' ? 'Reservations' : item === 'packages' ? 'Packages' : 'Event Times'}</button>)}</div>
              <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={busy} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" onClick={() => { void action(refresh, 'Booking data refreshed.') }}>Refresh</button><button type="button" disabled={busy} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" onClick={() => { void action(async () => { await iglooApi('/admin/logout', { body: {} }); setData(null); setLocalLogin(null) }, 'You’re signed out.') }}>Sign Out</button></div>
            </div>

            {view === 'bookings' ? (
              <div className="mt-7">
                <div className="flex flex-wrap items-end justify-between gap-5"><label className="block w-full text-sm sm:max-w-sm"><span className="mb-1.5 block font-medium">Find a booking</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, reference, or status" className="input-field" /></label><button type="button" disabled={busy} className="btn-outline disabled:opacity-60" onClick={() => { void action(async () => { await iglooApi('/admin/reconcile', { body: {} }); await refresh() }, 'Payment statuses checked and pending confirmation emails retried.') }}>{busy ? 'Working…' : 'Check Payments & Retry Emails'}</button></div>
                <p className="mt-4 text-sm text-navy-muted">Confirmed bookings are read-only here. Handle any refund or cancellation with the studio through Stripe.</p>
                <div className="mt-5 overflow-x-auto border border-navy/15"><table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Igloo reservations</caption><thead className="bg-navy text-ivory"><tr>{['Reference', 'Guest', 'Evening', 'Amount', 'Status'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{bookings.map(booking => <tr key={booking.id} className="border-t border-navy/10 align-top even:bg-white"><td className="px-4 py-4"><span className="font-semibold">{booking.reference}</span><span className="mt-1 block text-xs text-navy-muted">{booking.packageName}</span></td><td className="px-4 py-4"><span className="font-semibold">{booking.name}</span><span className="mt-1 block break-all">{booking.email}</span>{booking.phone ? <span className="mt-1 block">{booking.phone}</span> : null}<span className="mt-1 block text-xs text-navy-muted">{booking.guests} guests · One igloo</span></td><td className="px-4 py-4">{eventDate(booking.startsAt)}<span className="mt-1 block text-xs text-navy-muted">{eventTime(booking.startsAt)} – {eventTime(booking.endsAt)}</span></td><td className="px-4 py-4"><span className="font-semibold">{money(booking.totalCents ?? booking.amountCents, booking.currency)}</span><span className="mt-1 block text-xs text-navy-muted">Subtotal: {money(booking.amountCents, booking.currency)}</span><span className="mt-1 block text-xs text-navy-muted">Tax: {money(booking.taxCents ?? 0, booking.currency)}</span></td><td className="px-4 py-4"><span className={`font-semibold ${booking.status === 'needs_review' ? 'text-red-800' : ''}`}>{booking.status.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-navy-muted">Email: {booking.emailStatus.replaceAll('_', ' ')}</span></td></tr>)}{!bookings.length ? <tr><td colSpan={5} className="px-5 py-10 text-center text-navy-muted">{search ? 'No matching reservations.' : 'No reservations yet.'}</td></tr> : null}</tbody></table></div>
              </div>
            ) : null}

            {view === 'packages' ? (
              <div className="mt-7 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-3xl">Packages</h2><button type="button" className="btn-primary" onClick={() => setPackageEditor('new')}>Add Package</button></div>
                {packageEditor ? <IglooPackageEditor key={packageEditor === 'new' ? 'new' : packageEditor.id} item={packageEditor === 'new' ? undefined : packageEditor} onCancel={() => setPackageEditor(null)} onSave={async input => { await iglooApi('/admin/package', { body: input }); setPackageEditor(null); setNotice('Package saved.'); await refresh().catch(cause => setError(`Saved, but the list could not refresh: ${errorMessage(cause)}`)) }} /> : null}
                {data.packages.map(item => <article key={item.id} className="flex flex-col justify-between gap-5 border border-navy/15 bg-white p-5 sm:flex-row sm:items-start"><div><h3 className="font-display text-2xl font-semibold">{item.name}</h3><p className="mt-2 max-w-2xl text-sm text-navy-muted">{item.description}</p><p className="mt-3 text-sm">{money(item.amountCents)} · {item.durationMinutes} minutes · Up to {item.maxGuests} guests · {item.status === 'active' ? 'Active' : 'Draft'}</p></div><button type="button" className="btn-outline shrink-0" onClick={() => setPackageEditor(item)} aria-label={`Edit ${item.name}`}>Edit</button></article>)}
                {!data.packages.length ? <p className="text-navy-muted">Add your first package when its details and policy are ready.</p> : null}
              </div>
            ) : null}

            {view === 'times' ? (
              <div className="mt-7 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-3xl">Event times</h2><p className="mt-2 text-sm text-navy-muted">Displayed in New York time. Capacity is the number of whole igloos.</p></div><button type="button" className="btn-primary" onClick={() => setSlotEditor('new')}>Add Event Time</button></div>
                {slotEditor ? <IglooSlotEditor key={slotEditor === 'new' ? 'new' : slotEditor.id} item={slotEditor === 'new' ? undefined : slotEditor} onCancel={() => setSlotEditor(null)} onSave={async input => { await iglooApi('/admin/slot', { body: input }); setSlotEditor(null); setNotice('Event time saved.'); await refresh().catch(cause => setError(`Saved, but the list could not refresh: ${errorMessage(cause)}`)) }} /> : null}
                {[...data.slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).map(item => <article key={item.id} className="flex flex-col justify-between gap-5 border border-navy/15 bg-white p-5 sm:flex-row sm:items-center"><div><h3 className="font-display text-2xl font-semibold">{eventDate(item.startsAt)}</h3><p className="mt-2 text-sm">{eventTime(item.startsAt)} – {eventTime(item.endsAt)}</p><p className="mt-2 text-sm text-navy-muted">{item.remaining} of {item.capacity} igloos available · {item.status === 'open' ? 'Open' : 'Closed'}</p></div><button type="button" className="btn-outline shrink-0" onClick={() => setSlotEditor(item)} aria-label={`Edit ${eventDate(item.startsAt)} at ${eventTime(item.startsAt)}`}>Edit</button></article>)}
                {!data.slots.length ? <p className="text-navy-muted">No event times have been added.</p> : null}
              </div>
            ) : null}
          </>
        )}
        {notice ? <p role="status" className="mt-6 border-l-2 border-gold bg-ivory-warm p-4 text-sm">{notice}</p> : null}
        {error ? <p role="alert" className="mt-6 border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      </div>
    </section>
  )
}
