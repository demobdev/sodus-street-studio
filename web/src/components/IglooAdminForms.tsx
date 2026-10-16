import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorMessage, eventDate, eventTime, eventTimeInput, parseEventTime } from '../lib/igloo'
import type { IglooPackage, IglooSlot } from '../lib/igloo'

type PackageInput = Omit<IglooPackage, 'id'> & { id?: string }
type SlotInput = Omit<IglooSlot, 'id' | 'remaining'> & { id?: string }

export function IglooPackageEditor({ item, onSave, onCancel }: {
  item?: IglooPackage
  onSave: (data: PackageInput) => Promise<void>
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSave({
        ...(item ? { id: item.id } : {}),
        name: String(form.get('name') || '').trim(),
        description: String(form.get('description') || '').trim(),
        durationMinutes: Number(form.get('durationMinutes')),
        amountCents: Math.round(Number(form.get('price')) * 100),
        currency: 'usd',
        maxGuests: Number(form.get('maxGuests')),
        policyText: String(form.get('policyText') || '').trim(),
        status: form.get('status') === 'active' ? 'active' : 'draft',
      })
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} aria-label={item ? 'Edit package' : 'Add package'} className="border border-gold/40 bg-white p-5 sm:p-8">
      <h3 className="font-display text-3xl">{item ? 'Edit package' : 'Add a package'}</h3>
      <fieldset disabled={busy} className="mt-6 grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Package details</legend>
        <label className="block text-sm sm:col-span-2"><span className="mb-1.5 block font-medium">Package name</span><input name="name" className="input-field" required maxLength={160} defaultValue={item?.name} /></label>
        <label className="block text-sm sm:col-span-2"><span className="mb-1.5 block font-medium">What’s included</span><textarea name="description" className="input-field min-h-24" required defaultValue={item?.description} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Price per igloo (USD)</span><input name="price" className="input-field" type="number" min="0.50" step="0.01" required defaultValue={item ? (item.amountCents / 100).toFixed(2) : ''} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Duration (minutes)</span><input name="durationMinutes" className="input-field" type="number" min={1} step={1} required defaultValue={item?.durationMinutes} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Maximum guests per igloo</span><input name="maxGuests" className="input-field" type="number" min={1} step={1} required defaultValue={item?.maxGuests} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Package status</span><select name="status" className="input-field" defaultValue={item?.status || 'draft'}><option value="draft">Draft</option><option value="active">Active</option></select></label>
        <label className="block text-sm sm:col-span-2"><span className="mb-1.5 block font-medium">Booking and cancellation policy</span><textarea name="policyText" className="input-field min-h-32" required defaultValue={item?.policyText} /></label>
      </fieldset>
      <p className="mt-4 text-sm text-navy-muted">An active package is offered only when bookings are enabled. Saving here does not turn on live payments.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Save Package'}</button><button type="button" disabled={busy} onClick={onCancel} className="btn-outline">Cancel</button></div>
    </form>
  )
}

export function IglooSlotEditor({ item, onSave, onCancel }: {
  item?: IglooSlot
  onSave: (data: SlotInput) => Promise<void>
  onCancel: () => void
}) {
  const [starts, setStarts] = useState(eventTimeInput(item?.startsAt))
  const [ends, setEnds] = useState(eventTimeInput(item?.endsAt))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const startTime = parseEventTime(starts)
  const endTime = parseEventTime(ends)
  const startIso = startTime.iso
  const endIso = endTime.iso
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (startTime.error || endTime.error) { setError(startTime.error || endTime.error); return }
    if (Date.parse(endIso) <= Date.parse(startIso)) { setError('Choose an end time after the start time.'); return }
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await onSave({
        ...(item ? { id: item.id } : {}),
        startsAt: startIso,
        endsAt: endIso,
        capacity: Number(form.get('capacity')),
        status: form.get('status') === 'closed' ? 'closed' : 'open',
      })
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} aria-label={item ? 'Edit event time' : 'Add event time'} className="border border-gold/40 bg-white p-5 sm:p-8">
      <h3 className="font-display text-3xl">{item ? 'Edit event time' : 'Add an event time'}</h3>
      <p className="mt-3 text-sm text-navy-muted">Enter local New York times. Daylight saving time is applied automatically.</p>
      <fieldset disabled={busy} className="mt-6 grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Time and capacity</legend>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Start date and time (New York)</span><input className="input-field" type="datetime-local" required value={starts} onChange={event => setStarts(event.target.value)} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">End date and time (New York)</span><input className="input-field" type="datetime-local" required value={ends} onChange={event => setEnds(event.target.value)} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Number of igloos available</span><input className="input-field" name="capacity" type="number" min={1} step={1} required defaultValue={item?.capacity} /></label>
        <label className="block text-sm"><span className="mb-1.5 block font-medium">Availability</span><select className="input-field" name="status" defaultValue={item?.status || 'closed'}><option value="closed">Closed to new bookings</option><option value="open">Open for bookings</option></select></label>
      </fieldset>
      <div aria-live="polite" className="mt-5 border-l-2 border-gold bg-ivory-warm p-4 text-sm"><strong>Customer time · America/New_York</strong><p className="mt-2">{startIso ? `${eventDate(startIso)}, ${eventTime(startIso)}` : starts ? startTime.error : 'Choose a start time.'}</p>{endIso ? <p className="mt-1">Until {eventDate(endIso)}, {eventTime(endIso)}</p> : ends ? <p className="mt-1 text-red-800">{endTime.error}</p> : null}{startIso && endIso && Date.parse(endIso) > Date.parse(startIso) ? <p className="mt-2">{(Date.parse(endIso) - Date.parse(startIso)) / 60_000} minutes. Only packages of this duration will be offered.</p> : null}</div>
      <p className="mt-4 text-sm text-navy-muted">Capacity counts whole igloos, not guests. Overlapping times and capacity below existing bookings are rejected.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Saving…' : 'Save Event Time'}</button><button type="button" disabled={busy} onClick={onCancel} className="btn-outline">Cancel</button></div>
    </form>
  )
}
