import { createHmac, randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { Queryable } from './db.js';
import { sendEmail } from './email.js';
import { StoreError } from './store.js';

// Preserve the original inquiry recipient. This is deliberately not client-configurable.
const recipient = 'maat@onthemovecs.com';
const unavailable = 'We could not confirm your request was sent. Your details are still here; please try again later.';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed = new Set(['type', 'requestId', 'name', 'email', 'phone', 'message', 'projectType', 'sessionType', 'preferredDate', 'preferredTime', 'guests', 'addons', 'projectDescription', 'website']);

export interface Inquiry {
  type: 'studio' | 'contact' | 'igloo'; requestId: string; name: string; email: string;
  phone: string; message: string; projectType: string; sessionType: string; preferredDate: string;
  preferredTime: string; guests: string; addons: string; projectDescription: string;
}

function field(body: Record<string, unknown>, key: string, max: number, required = false, multiline = false): string {
  const raw = body[key];
  if (raw !== undefined && typeof raw !== 'string') throw new StoreError('Please check your form details.', 400, 'INVALID_INPUT');
  const value = (raw as string | undefined)?.trim() || '';
  if (value.length > max || (required && !value) || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) {
    throw new StoreError('Please check your form details.', 400, 'INVALID_INPUT');
  }
  return value;
}

export function parseInquiry(body: Record<string, unknown>): Inquiry {
  if (Object.keys(body).some(key => !allowed.has(key))) throw new StoreError('Please check your form details.', 400, 'INVALID_INPUT');
  const type = field(body, 'type', 10, true);
  const requestId = field(body, 'requestId', 36, true).toLowerCase();
  if (!['studio', 'contact', 'igloo'].includes(type) || !uuid.test(requestId)) throw new StoreError('Please check your form details.', 400, 'INVALID_INPUT');
  // Do not silently claim a bot-filled form was delivered.
  if (field(body, 'website', 300)) throw new StoreError('Unable to send this request.', 400, 'INVALID_INPUT');
  const email = field(body, 'email', 254, true).toLowerCase();
  const [local, domain, extra] = email.split('@');
  if (extra !== undefined || !local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain || !domain.includes('.') || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw new StoreError('Please enter a valid email address.', 400, 'INVALID_INPUT');
  }
  const preferredDate = field(body, 'preferredDate', 10, type === 'studio');
  if (preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(Date.parse(`${preferredDate}T12:00:00Z`)) || new Date(`${preferredDate}T12:00:00Z`).toISOString().slice(0, 10) !== preferredDate)) {
    throw new StoreError('Please enter a valid preferred date.', 400, 'INVALID_INPUT');
  }
  const preferredTime = field(body, 'preferredTime', 5, type === 'studio');
  if (preferredTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) throw new StoreError('Please enter a valid preferred time.', 400, 'INVALID_INPUT');
  const guests = field(body, 'guests', 4);
  if (guests && (!/^\d{1,4}$/.test(guests) || Number(guests) > 1000)) throw new StoreError('Please check the number of guests.', 400, 'INVALID_INPUT');
  return {
    type: type as Inquiry['type'], requestId, name: field(body, 'name', 100, true), email,
    phone: field(body, 'phone', 40), message: field(body, 'message', 8000, type !== 'studio', true),
    projectType: field(body, 'projectType', 120, type === 'contact'), sessionType: field(body, 'sessionType', 120, type === 'studio'),
    preferredDate, preferredTime, guests, addons: field(body, 'addons', 1000),
    projectDescription: field(body, 'projectDescription', 8000, type === 'studio', true),
  };
}

export class Inquiries {
  constructor(private readonly db: Queryable, private readonly config: Config) {}

  async submit(input: Inquiry): Promise<{ ok: true; simulated?: true }> {
    const c = this.config;
    if (c.local && c.mock) return { ok: true, simulated: true };
    if (!c.emailEnabled || !c.emailKey || !c.emailFrom) throw new StoreError(unavailable, 503, 'INQUIRY_UNAVAILABLE');
    const { requestId, ...content } = input;
    const fingerprint = createHmac('sha256', c.secret).update(JSON.stringify(content)).digest('hex');
    const claim = randomUUID();
    // A lease handles concurrent submissions; the provider key handles a crash after
    // acceptance. Stop ambiguous retries before Resend's 24-hour key retention expires.
    const claimed = await this.db.query(
      `INSERT INTO studio_inquiry_requests (request_id,payload_hash,status,claim_token,lease_until)
       VALUES ($1,$2,'sending',$3,now()+interval '30 seconds')
       ON CONFLICT (request_id) DO UPDATE SET status='sending',claim_token=$3,
         lease_until=now()+interval '30 seconds',updated_at=now()
       WHERE studio_inquiry_requests.payload_hash=$2
         AND studio_inquiry_requests.status <> 'sent'
         AND (studio_inquiry_requests.status='failed' OR studio_inquiry_requests.lease_until < now())
         AND studio_inquiry_requests.created_at > now()-interval '23 hours'
       RETURNING request_id`, [requestId, fingerprint, claim]);
    if (!claimed.rows.length) {
      const existing = (await this.db.query<{ payload_hash: string; status: string; retry_expired: boolean }>(
        `SELECT payload_hash,status,created_at <= now()-interval '23 hours' AS retry_expired
         FROM studio_inquiry_requests WHERE request_id=$1`, [requestId])).rows[0];
      if (existing?.payload_hash !== fingerprint) throw new StoreError('This request has changed. Please submit it again.', 409, 'INQUIRY_CHANGED');
      if (existing.status === 'sent') return { ok: true };
      if (existing.retry_expired) throw new StoreError(unavailable, 503, 'INQUIRY_REVIEW');
      throw new StoreError('Your request is still being sent. Please wait a moment before trying again.', 409, 'INQUIRY_SENDING');
    }
    const subject = input.type === 'studio' ? `Sodus Street Studio Booking Request — ${input.sessionType}`
      : input.type === 'igloo' ? 'Sodus Street Studio — Igloo Event Inquiry' : 'Sodus Street Studio Contact Inquiry';
    const details = [
      ['Name', input.name], ['Email', input.email], ['Phone', input.phone], ['Session type', input.sessionType],
      ['Project type', input.projectType], ['Preferred date', input.preferredDate], ['Preferred time (New York)', input.preferredTime],
      ['Number of guests', input.guests], ['Add-on services', input.addons], ['Project description', input.projectDescription], ['Message', input.message],
    ].filter(([, value]) => value).map(([label, value]) => `${label}:\n${value}`).join('\n\n');
    const text = `Website inquiry from ${c.origin}/${input.type === 'igloo' ? 'igloos' : input.type === 'studio' ? 'booking' : 'contact'}\n\n${details}\n\nInquiry only — no reservation, payment or inventory hold was created.\nReference: ${requestId}`;
    try {
      const providerId = await sendEmail(c, recipient, subject, text, `studio-inquiry/${requestId}`, { replyTo: input.email });
      await this.db.query(`UPDATE studio_inquiry_requests SET status='sent',provider_id=$3,claim_token=NULL,lease_until=NULL,updated_at=now()
        WHERE request_id=$1 AND claim_token=$2`, [requestId, claim, providerId]);
      return { ok: true };
    } catch {
      await this.db.query(`UPDATE studio_inquiry_requests SET status='failed',claim_token=NULL,lease_until=NULL,updated_at=now()
        WHERE request_id=$1 AND claim_token=$2`, [requestId, claim]);
      throw new StoreError(unavailable, 503, 'INQUIRY_UNAVAILABLE');
    }
  }
}
