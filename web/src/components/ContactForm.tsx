import { useState } from 'react'
import type { FormEvent } from 'react'

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-sm border border-gold/40 bg-ivory-warm p-8 text-center">
        <p className="section-label mb-3">Message sent</p>
        <h3 className="font-display text-3xl text-navy">We will be in touch soon.</h3>
        <p className="mx-auto mt-4 max-w-md text-navy-muted">
          Thanks for reaching out. We will help you choose the right session for
          your project.
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
      <button type="submit" className="btn-primary">
        Contact Us
      </button>
    </form>
  )
}
