import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, eventDate, eventTime, iglooApi, isLocalBookingHost, money, readBookingToken } from '../lib/igloo'
import type { IglooBooking } from '../lib/igloo'

export default function IglooTestCheckout() {
  const [token] = useState(readBookingToken)
  const [booking, setBooking] = useState<IglooBooking | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const local = isLocalBookingHost()
  const navigate = useNavigate()

  useEffect(() => {
    if (!local || !token) return
    const controller = new AbortController()
    void iglooApi<IglooBooking>('/booking', { token, signal: controller.signal })
      .then(setBooking)
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
    return () => controller.abort()
  }, [local, token])

  async function simulate(outcome: 'paid' | 'failed' | 'expired') {
    setBusy(true)
    setError('')
    try {
      await iglooApi('/simulate', { token, body: { outcome } })
      navigate(`/igloos/confirmation#token=${encodeURIComponent(token)}`, { replace: true })
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  if (!local) return <section className="section-pad"><div className="container-site"><h1 className="display-title">This page is unavailable.</h1><Link to="/igloos" className="btn-outline mt-6">Back to Igloo Events</Link></div></section>

  return (
    <section className="section-pad">
      <div className="container-site max-w-2xl">
        <div className="border border-gold bg-ivory-warm p-5 text-sm"><strong>Local simulation — no payment is collected.</strong><p className="mt-2">This exercises the booking flow on this computer. It does not create a real reservation or charge a card.</p></div>
        <h1 className="display-title mt-8">Test the checkout result.</h1>
        {booking?.mode === 'test' ? (
          <>
            <div className="my-8 border-y border-navy/15 py-6"><h2 className="font-display text-3xl">{booking.packageName}</h2><p className="mt-3">{eventDate(booking.startsAt)}</p><p className="mt-1 text-navy-muted">{eventTime(booking.startsAt)} – {eventTime(booking.endsAt)}</p><p className="mt-3 font-semibold">{money(booking.amountCents)} · Test amount</p></div>
            <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary disabled:opacity-60" disabled={busy} onClick={() => { void simulate('paid') }}>Simulate Successful Payment</button><button type="button" className="btn-outline disabled:opacity-60" disabled={busy} onClick={() => { void simulate('failed') }}>Simulate Failed Payment</button><button type="button" className="btn-outline disabled:opacity-60" disabled={busy} onClick={() => { void simulate('expired') }}>Simulate Expired Checkout</button></div>
          </>
        ) : <p className="mt-5 text-navy-muted">{!token ? 'Start a test booking to use the local simulator.' : booking ? 'Simulation is unavailable for this booking.' : 'Loading the test booking…'}</p>}
        {error ? <p role="alert" className="mt-5 text-sm text-red-800">{error}</p> : null}
        <Link to="/igloos/confirmation?cancelled=1" className="mt-8 inline-block text-sm underline decoration-gold underline-offset-4">Leave checkout and check booking status</Link>
      </div>
    </section>
  )
}
