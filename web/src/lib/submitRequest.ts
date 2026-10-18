export type InquiryType = 'studio' | 'contact' | 'igloo'
type SubmitPayload = Record<string, string | undefined>
type SubmitResult = { ok: true } | { ok: false; error: string }

const deliveryError = 'We couldn’t confirm your request was sent. Your details are still here; please try again later.'

// Each form owns its retry identity so two forms never share a request.
export function createStudioRequest() {
  let request: { fingerprint: string; id: string } | undefined

  return async (type: InquiryType, payload: SubmitPayload): Promise<SubmitResult> => {
    const fingerprint = JSON.stringify({ type, ...payload })
    if (request?.fingerprint !== fingerprint) {
      request = { fingerprint, id: crypto.randomUUID() }
    }
    try {
      const response = await fetch('/api/igloo/inquiry', {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...payload, type, requestId: request.id }),
      })
      const data: unknown = await response.json()
      const result = typeof data === 'object' && data !== null
        ? data as { ok?: unknown; simulated?: unknown }
        : null

      if (response.status === 429) {
        return { ok: false, error: 'Please wait a few minutes before sending another request. Your details are still here.' }
      }
      if (!response.ok || result?.ok !== true) return { ok: false, error: deliveryError }
      if (result.simulated === true) {
        return { ok: false, error: 'This is a local preview. No email was sent, and your details are still here.' }
      }
      request = undefined
      return { ok: true }
    } catch {
      return { ok: false, error: deliveryError }
    }
  }
}
