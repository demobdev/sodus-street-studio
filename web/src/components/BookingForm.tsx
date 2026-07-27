import { useState } from 'react'
import type { FormEvent } from 'react'
import { sessionTypes } from '../content/site'

export function BookingForm() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
          Thanks for reaching out. In production, this will sync with Acuity for
          live availability, payments, and confirmation emails.
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
        Demo form for the meeting walkthrough. Live calendar and payments will
        run through Acuity Scheduling at launch.
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
          <select className="input-field" name="sessionType" required defaultValue="">
            <option value="" disabled>
              Select a session
            </option>
            {sessionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
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

      <button type="submit" className="btn-primary w-full md:w-auto">
        Request Booking
      </button>
    </form>
  )
}
