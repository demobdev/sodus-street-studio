const STUDIO_EMAIL = 'maat@onthemovecs.com'

type SubmitPayload = Record<string, string | number | undefined>

export async function submitStudioRequest(
  subject: string,
  payload: SubmitPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${STUDIO_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
      }),
    })

    const data: unknown = await response.json()
    const result =
      typeof data === 'object' && data !== null
        ? (data as { success?: unknown; message?: unknown })
        : null

    if (!response.ok || (result?.success !== true && result?.success !== 'true')) {
      return {
        ok: false,
        error:
          typeof result?.message === 'string' && result.message.trim()
            ? result.message
            : 'We could not confirm your request was sent. Please try again or email maat@onthemovecs.com.',
      }
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'Unable to send request. Please email maat@onthemovecs.com directly.',
    }
  }
}
