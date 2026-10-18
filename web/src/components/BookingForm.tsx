import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { sessions } from '../content/sessions'
import { createStudioRequest } from '../lib/submitRequest'

type Props = {
  selectedSession?: string
}

export function BookingForm({ selectedSession = '' }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [sessionType, setSessionType] = useState(selectedSession)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const submitRequest = useMemo(createStudioRequest, [])

  useEffect(() => {
    if (selectedSession) {
      setSessionType(selectedSession)
      setSubmitted(false)
      setStatus('idle')
    }
  }, [selectedSession])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '')
    const email = String(form.get('email') || '')
    const phone = String(form.get('phone') || '')
    const date = String(form.get('date') || '')
    const time = String(form.get('time') || '')
    const guests = String(form.get('guests') || '0')
    const addons = String(form.get('addons') || '')
    const project = String(form.get('project') || '')
    const message = String(form.get('message') || '')

    const result = await submitRequest(
      'studio',
      {
        name,
        email,
        website: String(form.get('website') || ''),
        phone,
        sessionType,
        preferredDate: date,
        preferredTime: time,
        guests,
        addons,
        projectDescription: project,
        message,
      },
    )

    if (!result.ok) {
      setStatus('error')
      setErrorMessage(result.error)
      return
    }

    setStatus('idle')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div role="status" className="rounded-sm border border-gold/40 bg-ivory-warm p-8 text-center">
        <p className="section-label mb-3">Request received</p>
        <h3 className="font-display text-3xl text-navy">
          Your booking request is in.
        </h3>
        <p className="mx-auto mt-4 max-w-md text-navy-muted">
          Thanks for reaching out. Your request was sent to the studio team.
          We’ll follow up about availability and next steps. No session is reserved yet.
        </p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => setSubmitted(false)}
        >
          Submit another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Studio session request">
      <p className="rounded-sm border border-gold/30 bg-ivory-warm px-4 py-3 text-sm text-navy-muted">
        Your request goes directly to the studio team. We’ll confirm
        availability and payment details with you. Sending this form does not
        reserve a session or collect payment.
      </p>

      <div className="hidden" aria-hidden="true">
        <label>Leave this field blank<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Name</span>
          <input className="input-field" name="name" autoComplete="name" maxLength={100} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email</span>
          <input className="input-field" type="email" name="email" autoComplete="email" maxLength={254} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Phone</span>
          <input className="input-field" type="tel" name="phone" autoComplete="tel" maxLength={40} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Session Type</span>
          <select
            className="input-field"
            name="sessionType"
            required
            value={sessionType}
            onChange={(event) => setSessionType(event.target.value)}
          >
            <option value="" disabled>
              Select a session
            </option>
            {sessions.map((session) => (
              <option key={session.id} value={session.title}>
                {session.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Preferred Date</span>
          <input className="input-field" type="date" name="date" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Preferred Time</span>
          <input className="input-field" type="time" name="time" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Number of Guests</span>
          <input className="input-field" type="number" min={0} max={1000} name="guests" defaultValue={0} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Add-On Services</span>
          <input
            className="input-field"
            name="addons"
            maxLength={1000}
            placeholder="Editing, multi-camera, etc."
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Project Description</span>
        <textarea className="input-field min-h-28" name="project" maxLength={5000} required />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Message</span>
        <textarea className="input-field min-h-24" name="message" maxLength={5000} />
      </label>

      <label className="flex items-start gap-3 text-sm text-navy-muted">
        <input type="checkbox" required className="mt-1" />
        <span>
          I understand cancellations require at least 24 hours notice and that
          payment is due when the studio confirms my booking.
        </span>
      </label>

      {status === 'error' ? (
        <p role="alert" className="text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        className="btn-primary w-full md:w-auto disabled:opacity-60"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending Request…' : 'Request Booking'}
      </button>
    </form>
  )
}
