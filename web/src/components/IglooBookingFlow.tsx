import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { IglooApiError, errorMessage, eventDate, eventTime, iglooApi, matchesDuration, money, safeCheckoutUrl, saveBookingToken } from '../lib/igloo'
import type { IglooCatalog } from '../lib/igloo'

type Props = { catalog: IglooCatalog; onRefresh: () => Promise<void> }

export function IglooBookingFlow({ catalog, onRefresh }: Props) {
  const [packageId, setPackageId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [sending, setSending] = useState(false)
  const [reviewBlocked, setReviewBlocked] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<{ fingerprint: string; id: string } | null>(null)
  const packages = catalog.packages.filter(item => item.status === 'active')
  const selectedPackage = packages.find(item => item.id === packageId)
  const slots = selectedPackage
    ? catalog.slots.filter(slot => slot.status === 'open' && Date.parse(slot.startsAt) > Date.now() && matchesDuration(slot, selectedPackage)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    : []
  const selectedSlot = slots.find(slot => slot.id === slotId && slot.remaining > 0)

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPackage || !selectedSlot || sending || reviewBlocked) return
    const data = new FormData(event.currentTarget)
    const payload = {
      packageId: selectedPackage.id,
      slotId: selectedSlot.id,
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      guests: Number(data.get('guests')),
      policyAccepted: data.get('policyAccepted') === 'yes',
    }
    const fingerprint = JSON.stringify(payload)
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, id: crypto.randomUUID() }
    }
    setError('')
    setSending(true)
    try {
      const result = await iglooApi<{ checkoutUrl: string; bookingToken: string }>('/checkout', {
        body: { ...payload, requestId: request.current.id },
      })
      const checkoutUrl = safeCheckoutUrl(result.checkoutUrl)
      if (!checkoutUrl) throw new Error('We could not open a secure checkout. Please contact the studio before trying again.')
      saveBookingToken(result.bookingToken)
      window.location.assign(checkoutUrl)
    } catch (cause) {
      setError(errorMessage(cause))
      if (cause instanceof IglooApiError && cause.status === 409 && ['SOLD_OUT', 'UNAVAILABLE', 'HOLD_EXPIRED'].includes(cause.code || '')) {
        setSlotId('')
        request.current = null
        await onRefresh().catch(() => undefined)
      }
      if (cause instanceof IglooApiError && ['CHECKOUT_REVIEW', 'CHECK_STATUS', 'IDEMPOTENCY_CONFLICT'].includes(cause.code || '')) {
        setReviewBlocked(true)
        setError(`${cause.message} Please contact the studio before starting another booking.`)
      }
      setSending(false)
    }
  }

  return (
    <section id="igloo-booking" className="section-pad scroll-mt-28">
      <div className="container-site">
        {catalog.mode === 'test' ? (
          <div role="note" className="mb-8 border border-gold bg-ivory-warm px-5 py-4 text-sm leading-relaxed text-navy">
            <strong className="block">Test booking preview</strong>
            These packages and prices are for testing. No live reservation is offered here.
          </div>
        ) : null}
        {catalog.notice ? <p className="mb-8 max-w-3xl text-navy-muted">{catalog.notice}</p> : null}
        <div className="grid items-start gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div className="space-y-10">
            <fieldset disabled={sending || reviewBlocked}>
              <legend className="font-display text-3xl font-semibold">1. Choose your package</legend>
              <p className="mt-3 text-navy-muted">Each booking reserves one whole igloo for your group.</p>
              <div className="mt-5 space-y-3">
                {packages.map(item => (
                  <label key={item.id} className={`block cursor-pointer border p-5 transition focus-within:ring-2 focus-within:ring-gold ${item.id === packageId ? 'border-gold bg-ivory-warm' : 'border-navy/15 bg-white hover:border-gold'}`}>
                    <span className="flex items-start gap-3">
                      <input type="radio" name="igloo-package" value={item.id} checked={packageId === item.id} className="mt-1.5 accent-navy" onChange={() => { setPackageId(item.id); setSlotId(''); setError('') }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-2xl font-semibold">{item.name}</span>
                        <span className="mt-2 block text-sm leading-relaxed text-navy-muted">{item.description}</span>
                        <span className="mt-3 block text-sm">{item.durationMinutes} minutes · Up to {item.maxGuests} guests</span>
                        <span className="mt-3 block font-semibold">{money(item.amountCents)} per igloo, plus applicable tax{catalog.mode === 'test' ? ' · Test price' : ''}</span>
                      </span>
                    </span>
                  </label>
                ))}
                {!packages.length ? <p className="border border-navy/15 p-5">Packages are being prepared. Please check back soon.</p> : null}
              </div>
            </fieldset>

            {selectedPackage ? (
              <fieldset disabled={sending || reviewBlocked}>
                <legend className="font-display text-3xl font-semibold">2. Pick an evening</legend>
                <p className="mt-3 text-navy-muted">All times are shown in New York time. Availability is checked again at checkout.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {slots.map(slot => (
                    <label key={slot.id} className={`block border p-4 transition focus-within:ring-2 focus-within:ring-gold ${slot.remaining <= 0 ? 'cursor-not-allowed border-navy/10 bg-ivory-warm text-navy-muted' : slot.id === slotId ? 'cursor-pointer border-gold bg-ivory-warm' : 'cursor-pointer border-navy/15 bg-white hover:border-gold'}`}>
                      <span className="flex items-start gap-3">
                        <input type="radio" name="igloo-slot" value={slot.id} checked={slotId === slot.id} disabled={slot.remaining <= 0} className="mt-1 accent-navy" onChange={() => { setSlotId(slot.id); setError('') }} />
                        <span>
                          <span className="block font-semibold">{eventDate(slot.startsAt)}</span>
                          <span className="mt-2 block text-sm">{eventTime(slot.startsAt)} – {eventTime(slot.endsAt)}</span>
                          <span className="mt-2 block text-sm">{slot.remaining > 0 ? `${slot.remaining} ${slot.remaining === 1 ? 'igloo' : 'igloos'} available` : 'Sold out'}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {!slots.length ? <p className="mt-5 border border-navy/15 p-5">No upcoming times are available for this package yet.</p> : null}
                <button type="button" className="mt-4 text-sm font-semibold underline decoration-gold underline-offset-4" onClick={() => { setError(''); void onRefresh().catch(cause => setError(errorMessage(cause))) }}>Refresh availability</button>
              </fieldset>
            ) : null}

            {selectedPackage && selectedSlot ? (
              <form onSubmit={checkout} aria-label="Igloo booking details" className="space-y-5">
                <h2 className="font-display text-3xl font-semibold">3. Your details</h2>
                <fieldset disabled={sending || reviewBlocked} className="grid gap-4 sm:grid-cols-2">
                  <legend className="sr-only">Contact and party size</legend>
                  <label className="block text-sm"><span className="mb-1.5 block font-medium">Full name</span><input name="name" autoComplete="name" required maxLength={120} className="input-field" /></label>
                  <label className="block text-sm"><span className="mb-1.5 block font-medium">Email for confirmation</span><input name="email" autoComplete="email" type="email" required maxLength={254} className="input-field" /></label>
                  <label className="block text-sm"><span className="mb-1.5 block font-medium">Phone (optional)</span><input name="phone" autoComplete="tel" type="tel" maxLength={40} className="input-field" /></label>
                  <label className="block text-sm"><span className="mb-1.5 block font-medium">Guests in your group</span><input name="guests" type="number" min={1} max={selectedPackage.maxGuests} defaultValue={1} required className="input-field" /></label>
                </fieldset>
                <div className="border-l-2 border-gold bg-ivory-warm p-5">
                  <h3 className="font-semibold">Before you book</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-muted">{selectedPackage.policyText}</p>
                </div>
                <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="policyAccepted" value="yes" required disabled={sending || reviewBlocked} className="mt-1 accent-navy" /><span>I agree to the package and booking policy above.</span></label>
                <button type="submit" disabled={sending || reviewBlocked} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{sending ? 'Opening checkout…' : catalog.mode === 'test' ? 'Continue to Test Checkout' : 'Continue to Secure Checkout'}</button>
                <p className="text-sm text-navy-muted">Your reservation is confirmed only after payment is verified. Card details are handled by Stripe.</p>
              </form>
            ) : null}
            {error ? <div role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{reviewBlocked ? <a href="/contact" className="mt-3 inline-block font-semibold underline">Contact the studio</a> : null}</div> : null}
          </div>

          <aside aria-label="Booking summary" className="border-t-2 border-gold bg-navy p-6 text-ivory sm:p-8 lg:sticky lg:top-28">
            <h2 className="font-display text-3xl">Your evening</h2>
            {selectedPackage ? (
              <>
                <p className="mt-5 font-semibold">{selectedPackage.name}</p>
                <p className="mt-2 text-sm text-ivory/75">One igloo · {selectedPackage.durationMinutes} minutes</p>
                {selectedSlot ? <p className="mt-5 text-sm leading-relaxed text-ivory/85">{eventDate(selectedSlot.startsAt)}<br />{eventTime(selectedSlot.startsAt)} – {eventTime(selectedSlot.endsAt)}</p> : <p className="mt-5 text-sm text-ivory/75">Choose an available time to continue.</p>}
                <div className="mt-6 border-t border-ivory/20 pt-5"><span className="block text-sm text-ivory/75">{catalog.mode === 'test' ? 'Test package price' : 'Package price'}</span><span className="mt-2 block font-display text-4xl text-gold-light">{money(selectedPackage.amountCents)}</span><p className="mt-2 text-sm text-ivory/75">Plus applicable tax. Final tax and total are shown in secure checkout.</p></div>
              </>
            ) : <p className="mt-5 text-sm leading-relaxed text-ivory/75">Choose a package and time to see your booking summary here.</p>}
          </aside>
        </div>
      </div>
    </section>
  )
}
