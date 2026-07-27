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

    const data = (await response.json()) as { success?: string | boolean; message?: string }

    if (!response.ok) {
      return {
        ok: false,
        error: data.message || 'Unable to send request. Please try again.',
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
