import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, eventDate, eventTime, iglooApi, money, readBookingToken, safeCheckoutUrl } from '../lib/igloo'
import type { IglooBooking } from '../lib/igloo'

const statusCopy = {
  held: { title: 'Your time is on hold.', copy: 'Payment has not been confirmed yet. Complete checkout to finish your reservation.' },
  awaiting_payment: { title: 'We’re checking your payment.', copy: 'Your payment is still processing. Please wait for confirmation before making another booking.' },
  confirmed: { title: 'Your igloo is reserved.', copy: 'Payment is verified and your booking is confirmed. We look forward to welcoming you.' },
  expired: { title: 'This checkout has expired.', copy: 'This booking is not confirmed. Choose an available time to begin again.' },
  cancelled: { title: 'This booking is cancelled.', copy: 'This booking is no longer active. Contact the studio if you need help.' },
  needs_review: { title: 'Our team is reviewing your booking.', copy: 'We need to check your payment before confirming the reservation. Please contact the studio with your reference and avoid making another payment.' },
}

export default function IglooConfirmation() {
  const [token] = useState(readBookingToken)
  const [booking, setBooking] = useState<IglooBooking | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(token))
  const [checking, setChecking] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0
    setLoading(true)
    setChecking(true)
    setError('')
    async function check() {
      try {
        const result = await iglooApi<IglooBooking>('/booking', { token, signal: controller.signal })
        if (controller.signal.aborted) return
        setBooking(result)
        setLoading(false)
        checks += 1
        if ((result.status === 'held' || result.status === 'awaiting_payment') && checks < 12) {
          timer = setTimeout(() => { void check() }, 5000)
        } else {
          setChecking(false)
        }
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(errorMessage(cause))
        setLoading(false)
        setChecking(false)
      }
    }
    void check()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [token, refresh])

  const copy = booking ? statusCopy[booking.status] : null
  const resumeUrl = booking?.status === 'held' && booking.checkoutUrl ? safeCheckoutUrl(booking.checkoutUrl) : null

  return (
    <section className="section-pad">
      <div className="container-site max-w-3xl">
        <p className="section-label">Sodus Street · Igloo bookings</p>
        {booking?.mode === 'test' ? <div role="note" className="mt-5 border border-gold bg-ivory-warm p-4 text-sm"><strong>Test booking.</strong> This is a test result, not a live reservation.</div> : null}
        <div aria-live="polite" aria-atomic="true">
          <h1 className="display-title mt-5">{loading && !booking ? 'Checking your booking…' : copy?.title || 'Check your booking.'}</h1>
          <p className="mt-5 text-lg leading-relaxed text-navy-muted">{copy?.copy || (token ? 'We verify your booking with our payment system before showing a confirmation.' : 'Open the booking link from your checkout or confirmation email to see its status.')}</p>
        </div>
        {booking ? (
          <dl className="mt-8 grid gap-6 border-y border-navy/15 py-8 sm:grid-cols-2">
            <div><dt className="text-sm text-navy-muted">Reference</dt><dd className="mt-1 break-all font-semibold">{booking.reference}</dd></div>
            <div><dt className="text-sm text-navy-muted">Package</dt><dd className="mt-1 font-semibold">{booking.packageName}</dd></div>
            <div><dt className="text-sm text-navy-muted">Evening · New York time</dt><dd className="mt-1 leading-relaxed">{eventDate(booking.startsAt)}<br />{eventTime(booking.startsAt)} – {eventTime(booking.endsAt)}</dd></div>
            <div><dt className="text-sm text-navy-muted">Party</dt><dd className="mt-1">One igloo · {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</dd></div>
            <div><dt className="text-sm text-navy-muted">{booking.mode === 'test' ? 'Test amount' : 'Booking amount'}</dt><dd className="mt-1 font-semibold">{money(booking.amountCents, booking.currency)}</dd></div>
            {booking.status === 'confirmed' ? <div><dt className="text-sm text-navy-muted">Confirmation email</dt><dd className="mt-1">{booking.emailStatus === 'sent' ? 'Sent to the email you provided.' : booking.emailStatus === 'simulated' ? 'Simulated locally; no email sent.' : 'Your booking is confirmed. Email delivery is pending.'}</dd></div> : null}
          </dl>
        ) : null}
        {checking && booking ? <p role="status" className="mt-5 text-sm text-navy-muted">Checking for a payment update…</p> : null}
        {!checking && booking && ['held', 'awaiting_payment'].includes(booking.status) ? <p className="mt-5 text-sm text-navy-muted">Still waiting for confirmation. You can refresh the status here.</p> : null}
        {error ? <p role="alert" className="mt-5 border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
        <div className="mt-8 flex flex-wrap gap-4">
          {resumeUrl ? <a href={resumeUrl} className="btn-primary">Return to Checkout</a> : null}
          {token ? <button type="button" className="btn-outline disabled:opacity-60" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh Status</button> : null}
          <Link to="/igloos" className="btn-outline">Back to Igloo Events</Link>
        </div>
        <p className="mt-8 text-sm leading-relaxed text-navy-muted">Need help? <a href="mailto:maat@onthemovecs.com" className="break-words underline decoration-gold underline-offset-4">Email the studio</a>{booking ? ` and include reference ${booking.reference}.` : '.'}</p>
      </div>
    </section>
  )
}
