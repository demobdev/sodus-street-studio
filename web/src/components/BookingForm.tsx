import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { sessions } from '../content/sessions'
import { submitStudioRequest } from '../lib/submitRequest'

type Props = {
  selectedSession?: string
}

export function BookingForm({ selectedSession = '' }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [sessionType, setSessionType] = useState(selectedSession)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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

    const result = await submitStudioRequest(
      `Sodus Street Studio Booking Request — ${sessionType || 'Session'}`,
      {
        name,
        email,
        _replyto: email,
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
      <div className="rounded-sm border border-gold/40 bg-ivory-warm p-8 text-center">
        <p className="section-label mb-3">Request received</p>
        <h3 className="font-display text-3xl text-navy">
          Your booking request is in.
        </h3>
        <p className="mx-auto mt-4 max-w-md text-navy-muted">
          Thanks for reaching out. Your request was sent to the studio team at
          maat@onthemovecs.com. We’ll follow up to confirm your session.
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="rounded-sm border border-gold/30 bg-ivory-warm px-4 py-3 text-sm text-navy-muted">
        Requests are emailed to maat@onthemovecs.com for now. Live calendar and
        payments will run through Acuity Scheduling at launch.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Name</span>
          <input className="input-field" name="name" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email</span>
          <input className="input-field" type="email" name="email" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Phone</span>
          <input className="input-field" type="tel" name="phone" />
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
          <input className="input-field" type="number" min={0} name="guests" defaultValue={0} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Add-On Services</span>
          <input
            className="input-field"
            name="addons"
            placeholder="Editing, multi-camera, etc."
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Project Description</span>
        <textarea className="input-field min-h-28" name="project" required />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Message</span>
        <textarea className="input-field min-h-24" name="message" />
      </label>

      <label className="flex items-start gap-3 text-sm text-navy-muted">
        <input type="checkbox" required className="mt-1" />
        <span>
          I understand cancellations require at least 24 hours notice and that
          payment is due upon booking.
        </span>
      </label>

      {status === 'error' ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
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
