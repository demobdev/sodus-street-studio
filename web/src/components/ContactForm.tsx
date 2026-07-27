import { useState } from 'react'
import type { FormEvent } from 'react'
import { submitStudioRequest } from '../lib/submitRequest'

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '')
    const email = String(form.get('email') || '')
    const phone = String(form.get('phone') || '')
    const projectType = String(form.get('projectType') || '')
    const message = String(form.get('message') || '')

    const result = await submitStudioRequest('Sodus Street Studio Contact Inquiry', {
      name,
      email,
      _replyto: email,
      phone,
      projectType,
      message,
    })

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
        <p className="section-label mb-3">Message sent</p>
        <h3 className="font-display text-3xl text-navy">We will be in touch soon.</h3>
        <p className="mx-auto mt-4 max-w-md text-navy-muted">
          Thanks for reaching out. Your message was sent to maat@onthemovecs.com.
        </p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => setSubmitted(false)}
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <span className="mb-1.5 block font-medium">Project Type</span>
          <input
            className="input-field"
            name="projectType"
            placeholder="Podcast, voiceover, music..."
            required
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Message</span>
        <textarea className="input-field min-h-32" name="message" required />
      </label>

      {status === 'error' ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        className="btn-primary disabled:opacity-60"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending…' : 'Contact Us'}
      </button>
    </form>
  )
}
