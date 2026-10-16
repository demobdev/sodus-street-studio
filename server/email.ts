import type { Config } from './config.js';
import type { IglooStore } from './store.js';
export async function sendEmail(c: Config, to: string, subject: string, text: string, key: string): Promise<string> {
  if (!c.emailEnabled || !c.emailKey || !c.emailFrom) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${c.emailKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from: c.emailFrom, to: [to], subject, text }) });
  if (!response.ok) throw new Error(`Email service returned ${response.status}.`);
  const result = await response.json() as { id?: string }; if (!result.id) throw new Error('Email service did not acknowledge delivery.');
  return result.id;
}
export async function deliverConfirmations(store: IglooStore, c: Config) {
  // Simulation leaves an honest pending outbox; it does not claim a real email was sent.
  if (c.mock || !c.emailEnabled) return;
  // One delivery per invocation keeps webhook and API work inside the function time budget.
  for (const item of await store.claimConfirmationEmails(1)) {
    const b = item.booking;
    try {
      const time = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(b.startsAt));
      const id = await sendEmail(c, b.email, `${c.mode === 'test' ? '[TEST] ' : ''}Sodus Street igloo booking ${b.reference}`,
        `Hello ${b.name},\n\n${c.mode === 'test' ? 'TEST ONLY — this is not a real reservation.\n\n' : ''}Your payment is confirmed.\n\n${b.packageName}\n${time} (New York time)\n${b.guests} guests\nPaid: $${(b.amountCents / 100).toFixed(2)} USD\nReference: ${b.reference}\n\nBooking policy accepted:\n${b.policyText}\n\nQuestions? Contact Sodus Street Studio.`,
        `igloo-confirmation/${b.id}`);
      await store.markEmailSent(item.id, item.claimToken, id);
    } catch { await store.markEmailFailed(item.id, item.claimToken, 'Delivery failed; retry required.'); }
  }
}
