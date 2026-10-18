import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IglooPackageEditor, IglooSlotEditor } from '../components/IglooAdminForms'
import { IglooApiError, errorMessage, eventDate, eventTime, iglooApi, isLocalBookingHost, money } from '../lib/igloo'
import type { AdminBooking, IglooAdminData, IglooPackage, IglooSlot, RefundOperation } from '../lib/igloo'

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

const refundStatusCopy: Record<RefundOperation['status'], { label: string; description: string }> = {
  requested: { label: 'Refund queued', description: 'The full refund has been requested. Payment has not been refunded yet; the igloo stays reserved.' },
  pending: { label: 'Refund pending', description: 'Stripe is still processing the refund. The igloo stays reserved until the full refund is verified.' },
  succeeded: { label: 'Refund verified', description: 'The full refund is verified and the reservation is cancelled. Bank processing times may vary.' },
  failed: { label: 'Refund failed · needs attention', description: 'The refund did not complete. Review the payment in Stripe before taking another action.' },
  needs_review: { label: 'Refund needs staff review', description: 'We could not verify the full refund. Review the payment in Stripe; do not issue a duplicate refund.' },
}

function VenueRefundForm({ booking, requestId, eligible, onSave, onCancel }: {
  booking: AdminBooking
  requestId: string
  eligible: boolean
  onSave: (input: { bookingId: string; requestId: string; reason: RefundOperation['reason']; note: string }) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState<RefundOperation['reason']>('weather')
  const [note, setNote] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const amount = money(booking.totalCents ?? booking.amountCents, booking.currency)

  useEffect(() => { heading.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !eligible || !acknowledged || !note.trim()) return
    setSaving(true); setAttempted(true); setError('')
    try { await onSave({ bookingId: booking.id, requestId, reason, note: note.trim() }) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} aria-labelledby="venue-refund-title" className="mt-6 border border-gold bg-white p-5 sm:p-8">
      <h2 id="venue-refund-title" ref={heading} tabIndex={-1} className="font-display text-3xl">Refund for studio closure</h2>
      <p className="mt-3 font-semibold">{booking.reference} · {booking.name}</p>
      <p className="mt-1 text-sm text-navy-muted">{booking.packageName} · {eventDate(booking.startsAt)} at {eventTime(booking.startsAt)}</p>
      <div id="venue-refund-explanation" className="mt-5 border-l-2 border-gold bg-ivory-warm p-4 text-sm leading-relaxed">
        <p className="font-semibold">Full refund: {amount}, including tax.</p>
        <p className="mt-2">Use this only when Sodus Street Studio closes the event because of weather or an unforeseen circumstance. Customer cancellations, exchanges, and rescheduling are not permitted.</p>
        <p className="mt-2">This queues a refund for this reservation only. The booking stays reserved until Stripe confirms the full refund, then it is cancelled. Closing an event time does not refund other guests automatically.</p>
      </div>
      {!eligible ? <p role="alert" className="mt-5 text-sm text-red-800">This refund is no longer available. Close the form and refresh to check the booking, event time, and refund setup.</p> : null}
      <fieldset disabled={saving || attempted || !eligible} className="mt-5 space-y-5">
        <legend className="sr-only">Studio closure details</legend>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Reason for studio closure</span><select value={reason} onChange={event => setReason(event.target.value as RefundOperation['reason'])} className="input-field"><option value="weather">Weather</option><option value="venue_closure">Unforeseen studio closure</option></select></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Closure details for the staff record</span><textarea value={note} onChange={event => setNote(event.target.value)} required maxLength={1000} rows={3} className="input-field" aria-describedby="venue-refund-note-help" /><span id="venue-refund-note-help" className="mt-2 block text-xs text-navy-muted">Record why this event cannot go ahead. {note.length}/1,000 characters.</span></label>
        <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" required checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} aria-describedby="venue-refund-explanation" className="mt-1 size-4 shrink-0 accent-navy" /><span>I confirm the studio is closing this event and authorize a full {amount} refund and cancellation for {booking.reference}.</span></label>
      </fieldset>
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      {error && attempted ? <p className="mt-3 text-sm text-navy-muted">Retrying submits the same request. You can also close this form and refresh the refund list to check whether it was received.</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={saving || !eligible || !acknowledged || !note.trim()} className="btn-primary disabled:opacity-60">{saving ? 'Queuing…' : error && attempted ? 'Retry Same Refund Request' : `Queue Full Refund · ${amount}`}</button><button type="button" disabled={saving} onClick={onCancel} className="btn-outline disabled:opacity-60">Close</button></div>
    </form>
  )
}

function CancellationReviewForm({ booking, requestId, onSave, onCancel }: {
  booking: AdminBooking
  requestId: string | null
  onSave: (reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const withdrawing = requestId !== null
  const changed = withdrawing
    ? booking.cancellationRequest?.id !== requestId
    : booking.status !== 'confirmed' || !!booking.cancellationRequest

  useEffect(() => { heading.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || changed || !acknowledged) return
    if (!withdrawing && !reason.trim()) { setError('Enter a reason for the cancellation review.'); return }
    setSaving(true); setError('')
    try { await onSave(reason.trim()) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} aria-labelledby="cancellation-review-title" className="mt-6 border border-gold bg-white p-5 sm:p-8">
      <h2 id="cancellation-review-title" ref={heading} tabIndex={-1} className="font-display text-3xl">{withdrawing ? 'Withdraw cancellation review' : 'Request cancellation review'}</h2>
      <p className="mt-3 font-semibold">{booking.reference} · {booking.name}</p>
      <p className="mt-1 text-sm text-navy-muted">{booking.packageName} · {eventDate(booking.startsAt)} at {eventTime(booking.startsAt)}</p>
      {changed ? <p role="alert" className="mt-5 text-sm text-red-800">This booking changed since you opened the form. Close this form and review its current status before continuing.</p> : (
        <>
          <p id="cancellation-review-explanation" className="mt-5 border-l-2 border-gold bg-ivory-warm p-4 text-sm leading-relaxed">{withdrawing ? 'This removes the review flag only. The reservation keeps its current status and the igloo stays reserved. No payment changes or guest notification will be made.' : 'This flags the booking for staff review only. It does not cancel the reservation, issue a refund, release the igloo, or notify the guest. The reservation stays confirmed until the studio resolves it.'}</p>
          <fieldset disabled={saving} className="mt-5 space-y-5">
            <legend className="sr-only">Cancellation review details</legend>
            {withdrawing ? <div className="text-sm"><p className="font-semibold">Reason for the existing review</p><p className="mt-2 whitespace-pre-wrap break-words text-navy-muted">{booking.cancellationRequest?.reason}</p></div> : (
              <label className="block text-sm"><span className="mb-1.5 block font-medium">Reason for review</span><textarea name="reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} rows={3} aria-describedby="cancellation-reason-help" className="input-field" /><span id="cancellation-reason-help" className="mt-2 block text-xs text-navy-muted">Record the question and any details the studio needs. This review does not authorize a policy exception. {reason.length}/1,000 characters.</span></label>
            )}
            <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" required checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} aria-describedby="cancellation-review-explanation" className="mt-1 size-4 shrink-0 accent-navy" /><span>{withdrawing ? 'I want to remove this review flag. The booking and payment will remain unchanged.' : 'I understand this is a review request only. The booking and payment will remain unchanged.'}</span></label>
          </fieldset>
        </>
      )}
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={saving || changed || !acknowledged || (!withdrawing && !reason.trim())} className="btn-primary disabled:opacity-60">{saving ? 'Saving…' : withdrawing ? 'Withdraw Review Request' : 'Save Review Request'}</button><button type="button" disabled={saving} onClick={onCancel} className="btn-outline disabled:opacity-60">Close</button></div>
    </form>
  )
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
  const [cancellationEditor, setCancellationEditor] = useState<{ bookingId: string; requestId: string | null } | null>(null)
  const [refundEditor, setRefundEditor] = useState<{ bookingId: string; requestId: string } | null>(null)
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
  const pendingReviews = data?.bookings.filter(booking => booking.cancellationRequest) || []
  const reviewBooking = data?.bookings.find(booking => booking.id === cancellationEditor?.bookingId)
  const refunds = data?.refunds || []
  const refundBooking = data?.bookings.find(booking => booking.id === refundEditor?.bookingId)
  const refundsByBooking = new Map(refunds.map(refund => [refund.bookingId, refund]))
  const slotsById = new Map(data?.slots.map(slot => [slot.id, slot]) || [])
  const canRefund = (booking: AdminBooking) => !!data?.refundsEnabled && booking.status === 'confirmed' && slotsById.get(booking.slotId)?.status === 'closed' && !refundsByBooking.has(booking.id)

  async function saveRefund(input: { bookingId: string; requestId: string; reason: RefundOperation['reason']; note: string }) {
    setBusy(true); setError(''); setNotice('')
    try {
      await iglooApi<{ ok: true; refund: RefundOperation }>('/admin/refund', { body: input })
      setRefundEditor(null)
      setNotice('Full refund requested. Check its status below; the igloo remains reserved until the full refund is verified.')
      await refresh().catch(cause => setError(`Request saved, but the list could not refresh: ${errorMessage(cause)}`))
    } finally { setBusy(false) }
  }

  function openRefund(booking: AdminBooking) {
    setCancellationEditor(null)
    setRefundEditor({ bookingId: booking.id, requestId: crypto.randomUUID() })
  }

  function closeEventTime(booking: AdminBooking) {
    const slot = slotsById.get(booking.slotId)
    if (!slot) return
    setRefundEditor(null)
    setSlotEditor(slot)
    setView('times')
  }

  async function saveCancellationReview(reason: string) {
    if (!cancellationEditor) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { bookingId, requestId } = cancellationEditor
      await iglooApi(requestId ? '/admin/cancellation-withdraw' : '/admin/cancellation-request', {
        body: requestId ? { bookingId, requestId } : { bookingId, reason },
      })
      setCancellationEditor(null)
      setNotice(requestId ? 'Review request withdrawn. The booking and payment are unchanged.' : 'Cancellation review requested. The igloo remains reserved. No refund or guest email was sent.')
      await refresh().catch(cause => setError(`Saved, but the list could not refresh: ${errorMessage(cause)}`))
    } finally { setBusy(false) }
  }

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
              <div className="flex flex-wrap gap-2" aria-label="Booking management views">{(['bookings', 'packages', 'times'] as const).map(item => <button key={item} type="button" disabled={busy} aria-pressed={view === item} onClick={() => setView(item)} className={`px-4 py-3 text-sm font-semibold transition ${view === item ? 'bg-navy text-ivory' : 'border border-navy/15 hover:border-gold'}`}>{item === 'bookings' ? 'Reservations' : item === 'packages' ? 'Packages' : 'Event Times'}</button>)}</div>
              <div className="flex flex-wrap gap-4 text-sm"><button type="button" disabled={busy} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" onClick={() => { void action(refresh, 'Booking data refreshed.') }}>Refresh</button><button type="button" disabled={busy} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" onClick={() => { void action(async () => { await iglooApi('/admin/logout', { body: {} }); setData(null); setLocalLogin(null) }, 'You’re signed out.') }}>Sign Out</button></div>
            </div>

            {view === 'bookings' ? (
              <div className="mt-7">
                <div className="flex flex-wrap items-end justify-between gap-5"><label className="block w-full text-sm sm:max-w-sm"><span className="mb-1.5 block font-medium">Find a booking</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, reference, or status" className="input-field" /></label><button type="button" disabled={busy} className="btn-outline disabled:opacity-60" onClick={() => { void action(async () => { await iglooApi('/admin/reconcile', { body: {} }); await refresh() }, 'Payment statuses checked and pending confirmation emails retried.') }}>{busy ? 'Working…' : 'Check Payments & Retry Emails'}</button></div>
                <div className="mt-5 border-l-2 border-gold bg-ivory-warm p-4 text-sm leading-relaxed"><p className="font-semibold">Booking policy</p><p className="mt-2">Customer cancellations, refunds, exchanges, and rescheduling are not permitted. Full refunds apply only when the studio closes an event because of weather or an unforeseen circumstance.</p><p className="mt-2">For a studio closure, first close the affected seating under Event Times, then request a full refund for each confirmed reservation. Each igloo remains reserved until its refund is verified.</p></div>
                {!data.refundsEnabled ? <p role="note" className="mt-4 text-sm text-navy-muted">Refund processing is not enabled yet. Closure refunds will be available here once payment permissions and setup checks are complete.</p> : null}
                <p className="mt-4 text-sm text-navy-muted">A cancellation review records a staff question only. It does not override the policy, change a payment, or send a guest email.</p>
                {pendingReviews.length ? (
                  <section aria-labelledby="pending-cancellations-title" className="mt-6 border border-gold bg-ivory-warm p-5">
                    <h2 id="pending-cancellations-title" className="font-display text-2xl">Cancellation reviews · {pendingReviews.length}</h2>
                    <p className="mt-2 text-sm text-navy-muted">These review flags do not change the reservation or payment. Resolve each question under the booking policy; a review does not authorize a customer cancellation or refund.</p>
                    <ul className="mt-4 divide-y divide-navy/15">{pendingReviews.map(booking => {
                      const request = booking.cancellationRequest!
                      return <li key={request.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                          <div className="min-w-0 flex-1"><h3 className="font-semibold">{booking.reference} · {booking.name}</h3><p className="mt-1 text-sm">{eventDate(booking.startsAt)} at {eventTime(booking.startsAt)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{request.reason}</p><p className="mt-2 break-words text-xs text-navy-muted">Requested by {request.requestedBy} · {eventDate(request.requestedAt)} at {eventTime(request.requestedAt)}</p></div>
                          <button type="button" disabled={busy} onClick={() => { setRefundEditor(null); setCancellationEditor({ bookingId: booking.id, requestId: request.id }) }} className="btn-outline shrink-0 disabled:opacity-60" aria-label={`Withdraw cancellation review for ${booking.reference}`}>Withdraw Review</button>
                        </div>
                      </li>
                    })}</ul>
                  </section>
                ) : null}
                {refunds.length ? (
                  <section aria-labelledby="closure-refunds-title" className="mt-6 border border-navy/15 bg-white p-5">
                    <h2 id="closure-refunds-title" className="font-display text-2xl">Studio closure refunds · {refunds.length}</h2>
                    <p className="mt-2 text-sm text-navy-muted">Queued requests still need processing. A verified full refund cancels the reservation; failed or uncertain refunds need staff attention.</p>
                    <ul className="mt-4 divide-y divide-navy/15">{refunds.map(refund => {
                      const booking = data.bookings.find(item => item.id === refund.bookingId)
                      const state = refundStatusCopy[refund.status]
                      const attention = refund.status === 'failed' || refund.status === 'needs_review'
                      return <li key={refund.id} className="py-5 first:pt-0 last:pb-0">
                        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold">{booking ? `${booking.reference} · ${booking.name}` : 'Reservation'} · {money(refund.amountCents, refund.currency)}</h3>
                            {booking ? <p className="mt-1 text-sm">{eventDate(booking.startsAt)} at {eventTime(booking.startsAt)}</p> : null}
                            <p className={`mt-3 text-sm font-semibold ${attention ? 'text-red-800' : ''}`}>{state.label}</p>
                            <p className="mt-1 text-sm text-navy-muted">{state.description}</p>
                            {attention && booking?.status === 'cancelled' ? <p className="mt-2 text-sm font-semibold text-red-800">The reservation remains cancelled. Contact the guest and resolve the payment; this notice does not reinstate the booking.</p> : null}
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm">{refund.reason === 'weather' ? 'Weather' : 'Unforeseen studio closure'}: {refund.note}</p>
                            <p className="mt-2 break-words text-xs text-navy-muted">Requested by {refund.actor} · {eventDate(refund.createdAt)} at {eventTime(refund.createdAt)}</p>
                            {refund.refundId ? <p className="mt-2 break-all text-xs text-navy-muted">Stripe refund: {refund.refundId}</p> : null}
                            {refund.error ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-800">{refund.error}</p> : null}
                          </div>
                          {refund.status !== 'succeeded' ? <button type="button" disabled={busy || !data.refundsEnabled} onClick={() => { void action(async () => { await iglooApi('/admin/refund/reconcile', { body: { bookingId: refund.bookingId } }); await refresh() }, 'Refund status checked. Review the result in the refund list.') }} className="btn-outline shrink-0 disabled:opacity-60" aria-label={`${refund.status === 'requested' ? 'Process' : 'Check'} refund for ${booking?.reference || 'reservation'}`}>{refund.status === 'requested' ? 'Process Refund' : 'Check Refund Status'}</button> : null}
                        </div>
                      </li>
                    })}</ul>
                  </section>
                ) : null}
                {cancellationEditor && reviewBooking ? <CancellationReviewForm key={`${cancellationEditor.bookingId}/${cancellationEditor.requestId || 'new'}`} booking={reviewBooking} requestId={cancellationEditor.requestId} onSave={saveCancellationReview} onCancel={() => setCancellationEditor(null)} /> : null}
                {refundEditor && refundBooking ? <VenueRefundForm key={refundEditor.requestId} booking={refundBooking} requestId={refundEditor.requestId} eligible={canRefund(refundBooking)} onSave={saveRefund} onCancel={() => setRefundEditor(null)} /> : null}
                <div className="mt-5 overflow-x-auto border border-navy/15">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <caption className="sr-only">Igloo reservations</caption>
                    <thead className="bg-navy text-ivory"><tr>{['Reference', 'Guest', 'Evening', 'Amount', 'Status', 'Staff actions'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
                    <tbody>{bookings.map(booking => <tr key={booking.id} className="border-t border-navy/10 align-top even:bg-white">
                      <td className="px-4 py-4"><span className="font-semibold">{booking.reference}</span><span className="mt-1 block text-xs text-navy-muted">{booking.packageName}</span></td>
                      <td className="px-4 py-4"><span className="font-semibold">{booking.name}</span><span className="mt-1 block break-all">{booking.email}</span>{booking.phone ? <span className="mt-1 block">{booking.phone}</span> : null}<span className="mt-1 block text-xs text-navy-muted">{booking.guests} guests · One igloo</span></td>
                      <td className="px-4 py-4">{eventDate(booking.startsAt)}<span className="mt-1 block text-xs text-navy-muted">{eventTime(booking.startsAt)} – {eventTime(booking.endsAt)}</span></td>
                      <td className="px-4 py-4"><span className="font-semibold">{money(booking.totalCents ?? booking.amountCents, booking.currency)}</span><span className="mt-1 block text-xs text-navy-muted">Subtotal: {money(booking.amountCents, booking.currency)}</span><span className="mt-1 block text-xs text-navy-muted">Tax: {money(booking.taxCents ?? 0, booking.currency)}</span></td>
                      <td className="px-4 py-4"><span className={`font-semibold ${booking.status === 'needs_review' ? 'text-red-800' : ''}`}>{booking.status.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-navy-muted">Email: {booking.emailStatus.replaceAll('_', ' ')}</span>{refundsByBooking.get(booking.id)?.status === 'succeeded' ? <span className="mt-2 block text-xs font-semibold">Full refund verified</span> : null}{booking.cancellationRequest ? <span className="mt-2 inline-block border border-gold bg-ivory-warm px-2 py-1 text-xs font-semibold">Cancellation review pending</span> : null}</td>
                      <td className="px-4 py-4"><div className="flex flex-col items-start gap-4">{booking.cancellationRequest ? <button type="button" disabled={busy} onClick={() => { setRefundEditor(null); setCancellationEditor({ bookingId: booking.id, requestId: booking.cancellationRequest!.id }) }} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" aria-label={`Review cancellation request for ${booking.reference}`}>Review Request</button> : booking.status === 'confirmed' ? <button type="button" disabled={busy} onClick={() => { setRefundEditor(null); setCancellationEditor({ bookingId: booking.id, requestId: null }) }} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" aria-label={`Request cancellation review for ${booking.reference}`}>Request Staff Review</button> : null}
                        {refundsByBooking.has(booking.id) ? <span className="text-xs text-navy-muted">{refundStatusCopy[refundsByBooking.get(booking.id)!.status].label} · see above</span> : canRefund(booking) ? <button type="button" disabled={busy} onClick={() => openRefund(booking)} className="font-semibold underline decoration-gold underline-offset-4 disabled:opacity-50" aria-label={`Request studio closure refund for ${booking.reference}`}>Studio Closure Refund</button> : booking.status === 'confirmed' && slotsById.get(booking.slotId)?.status === 'open' ? <button type="button" disabled={busy} onClick={() => closeEventTime(booking)} className="text-left text-xs underline decoration-gold underline-offset-4 disabled:opacity-50" aria-label={`Close event time before refunding ${booking.reference}`}>Close event time before a closure refund</button> : booking.status === 'confirmed' && !data.refundsEnabled ? <span className="text-xs text-navy-muted">Refund setup pending</span> : !booking.cancellationRequest ? <span className="text-xs text-navy-muted">No action available</span> : null}
                      </div></td>
                    </tr>)}{!bookings.length ? <tr><td colSpan={6} className="px-5 py-10 text-center text-navy-muted">{search ? 'No matching reservations.' : 'No reservations yet.'}</td></tr> : null}</tbody>
                  </table>
                </div>
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
                <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-3xl">Event times</h2><p className="mt-2 text-sm text-navy-muted">Displayed in New York time. Capacity is the number of whole igloos. Closing a time stops new reservations; existing reservations need individual closure refunds.</p></div><button type="button" className="btn-primary" onClick={() => setSlotEditor('new')}>Add Event Time</button></div>
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
