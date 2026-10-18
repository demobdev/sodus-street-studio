import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createStudioRequest } from '../lib/submitRequest'

type Props = {
  inquiryType?: 'studio' | 'igloo'
}

export function ContactForm({ inquiryType = 'studio' }: Props) {
  const isIglooInquiry = inquiryType === 'igloo'
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const submitRequest = useMemo(createStudioRequest, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '')
    const email = String(form.get('email') || '')
    const phone = String(form.get('phone') || '')
    const projectType = isIglooInquiry
      ? 'Igloo event inquiry'
      : String(form.get('projectType') || '')
    const preferredDate = String(form.get('preferredDate') || '')
    const message = String(form.get('message') || '')

    const result = await submitRequest(
      isIglooInquiry ? 'igloo' : 'contact',
      {
        name,
        email,
        website: String(form.get('website') || ''),
        phone,
        projectType,
        ...(isIglooInquiry ? { preferredDate } : {}),
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
        <p className="section-label mb-3">Message sent</p>
        <h3 className="font-display text-3xl text-navy">We will be in touch soon.</h3>
        <p className="mx-auto mt-4 max-w-md text-navy-muted">
          Thanks for reaching out. Your message was sent to the studio team.
        </p>
        {isIglooInquiry ? (
          <p className="mx-auto mt-3 max-w-md text-sm text-navy-muted">
            We’ll reply with more details. This inquiry does not reserve an igloo
            or take a payment.
          </p>
        ) : null}
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
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={isIglooInquiry ? 'Igloo event inquiry' : 'Contact the studio'}>
      {isIglooInquiry ? (
        <p className="border-l-2 border-gold pl-4 text-sm leading-relaxed text-navy-muted">
          Ask about our Under the Stars igloo evenings. Sending an inquiry does
          not reserve a space or take a payment.
        </p>
      ) : null}
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
          {isIglooInquiry ? (
            <>
              <span className="mb-1.5 block font-medium">Preferred Date (optional)</span>
              <input className="input-field" type="date" name="preferredDate" />
            </>
          ) : (
            <>
              <span className="mb-1.5 block font-medium">Project Type</span>
              <input
                className="input-field"
                name="projectType"
                maxLength={120}
                placeholder="Podcast, voiceover, music..."
                required
              />
            </>
          )}
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Message</span>
        <textarea
          className="input-field min-h-32"
          name="message"
          maxLength={5000}
          placeholder={isIglooInquiry ? 'Tell us about your plans and any questions you have.' : undefined}
          required
        />
      </label>

      {status === 'error' ? (
        <p role="alert" className="text-sm text-red-700">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        className="btn-primary disabled:opacity-60"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending…' : isIglooInquiry ? 'Send an Inquiry' : 'Contact Us'}
      </button>
    </form>
  )
}
