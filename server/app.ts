import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { createDatabase, type Database } from './db.js';
import { IglooStore, StoreError, type Booking, type HoldInput, type PackageInput, type SlotInput } from './store.js';
import { AdminAuth } from './auth.js';
import { Payments } from './payments.js';
import { bookingId, bookingToken } from './tokens.js';
import { readiness, type Config } from './config.js';
import { deliverConfirmations, sendEmail } from './email.js';
import { authorizedJob, runBookingJobs } from './jobs.js';
import { Refunds } from './refunds.js';
import { deliverBookingAlerts } from './booking-alerts.js';

const header = (req: IncomingMessage, name: string) => { const value = req.headers[name]; return Array.isArray(value) ? value[0] : value || ''; };
const cookieName = 'sodus_igloo_admin';
function cookie(req: IncomingMessage) { return header(req,'cookie').split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || ''; }
export function publicBooking(b: Booking) {
  return { mode: b.livemode ? 'live' : 'test', reference: b.reference, status: b.status, packageName: b.packageName,
    startsAt: b.startsAt, endsAt: b.endsAt, guests: b.guests, amountCents: b.amountCents, currency: b.currency,
    taxCents: b.taxCents, totalCents: b.totalCents,
    emailStatus: b.emailStatus, refundedAt: b.refundedAt, ...(b.status === 'held' && b.checkoutUrl ? { checkoutUrl: b.checkoutUrl } : {}) };
}
async function rawBody(req: IncomingMessage): Promise<Buffer> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { const part = Buffer.from(chunk); size += part.length; if (size > 65_536) throw new StoreError('Request is too large.', 413, 'TOO_LARGE'); chunks.push(part); }
  return Buffer.concat(chunks);
}
export function createApp(c: Config, existingDb?: Database) {
  let initialized: Promise<{ store: IglooStore; auth: AdminAuth; payments: Payments; refunds: Refunds }> | undefined;
  const initialize = () => initialized ??= (async () => {
    const db = existingDb || await createDatabase(c.mock ? { localPath: './.data/igloo-local' } : { connectionString: c.databaseUrl });
    const store = new IglooStore(db); await store.init();
    const payments = new Payments(store,c);
    return { store, auth: new AdminAuth(db, c.secret, c.adminEmails), payments, refunds: new Refunds(store,c,payments) };
  })().catch(error => { initialized = undefined; throw error; });
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url || '/', c.origin);
      const route = url.searchParams.has('route') ? `/${url.searchParams.get('route')}` : url.pathname.replace(/^\/api\/igloo/, '');
      const method = req.method || 'GET';
      if (route === '/jobs') {
        if (method !== 'GET') return reply(405, { error: 'Method not allowed.' });
        if (!authorizedJob(header(req, 'authorization'), c.cronSecret)) return reply(401, { error: 'Unauthorized.', code: 'UNAUTHORIZED' });
        const { store, payments, refunds } = await initialize();
        const result = await runBookingJobs(store, payments, c, refunds);
        return reply(result.failures ? 503 : 200, { ok: result.failures === 0, ...result });
      }
      const missing = readiness(c);
      if (route === '/catalog' && method === 'GET' && (c.secret.length < 32 || (!c.mock && !c.databaseUrl))) {
        return reply(200, { mode: 'unconfigured', bookingOpen: false, notice: 'Online reservations are not open yet. Send an inquiry to plan your visit.', packages: [], slots: [] });
      }
      const { store, auth, payments, refunds } = await initialize();
      const ip = c.local ? req.socket.remoteAddress || 'local' : header(req,'x-vercel-forwarded-for').split(',')[0]?.trim() || 'unknown';
      const rate = async (key: string, max: number, seconds: number) => { if (!await auth.limit(key, max, seconds)) throw new StoreError('Please wait a moment before trying again.', 429, 'RATE_LIMIT'); };
      if (route === '/webhook' && method === 'POST') {
        await payments.webhook(await rawBody(req), header(req,'stripe-signature'), event => refunds.webhook(event));
        await deliverConfirmations(store,c); await deliverBookingAlerts(store,c); return reply(200,{ok:true});
      }
      if (!['GET','POST'].includes(method)) return reply(405,{error:'Method not allowed.'});
      let body: Record<string, unknown> = {};
      if (method === 'POST') {
        if (header(req,'origin') !== c.origin) throw new StoreError('Request origin is not allowed.',403,'ORIGIN');
        if (!header(req,'content-type').startsWith('application/json')) throw new StoreError('Use a JSON request.',415,'CONTENT_TYPE');
        try { body = JSON.parse((await rawBody(req)).toString('utf8')); }
        catch (error) { if (error instanceof StoreError) throw error; throw new StoreError('Invalid request.',400,'INVALID_JSON'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StoreError('Invalid request.',400,'INVALID_JSON');
      }
      if (route === '/catalog' && method === 'GET') {
        const bookingOpen = missing.length === 0;
        return reply(200,{mode:c.mode,bookingOpen,notice:c.mock ? 'Local simulation — no payment is collected. Sample packages and times are for testing only.' : c.mode === 'test' ? 'Test booking only — this does not create a real reservation.' : bookingOpen ? 'Choose your igloo experience and time.' : 'Online reservations are not open yet. Send an inquiry to plan your visit.',
          packages:bookingOpen ? await store.listPackages() : [],slots:bookingOpen ? await store.listSlots() : []});
      }
      if (route === '/checkout' && method === 'POST') {
        if (missing.length) throw new StoreError('Booking is not open yet. Please check back soon.',503,'NOT_CONFIGURED');
        await rate(`checkout:${ip}`,20,3600);
        const {packageId,slotId,name,email,phone,guests,policyAccepted,requestId} = body;
        if ([packageId,slotId,name,email,requestId].some(x=>typeof x !== 'string') || (phone !== undefined && typeof phone !== 'string') || typeof guests !== 'number') throw new StoreError('Please check your booking details.',400,'INVALID_INPUT');
        await payments.verifyAccount();
        const held = await store.createHold({packageId,slotId,name,email,phone,guests,policyAccepted,requestId} as HoldInput,{livemode:c.mode==='live'});
        const booking = await payments.checkout(held);
        if (booking.status !== 'held') throw new StoreError('This checkout needs staff review.',409,'CHECKOUT_REVIEW');
        return reply(200,{checkoutUrl:booking.checkoutUrl,bookingToken:bookingToken(booking.id,c.secret)});
      }
      if ((route === '/booking' && method === 'GET') || (route === '/simulate' && method === 'POST')) {
        if (route === '/simulate' && (!c.local || !c.mock || process.env.VERCEL || process.env.NODE_ENV === 'production')) return reply(404,{error:'Not found.'});
        await rate(`status:${ip}`,240,60);
        const id = bookingId(header(req,'authorization').replace(/^Bearer /,''),c.secret);
        let b = id ? await store.getBooking(id) : null;
        if (!b) throw new StoreError('Booking not found.',404,'NOT_FOUND');
        if (route === '/simulate') {
          const outcome = body.outcome;
          if (!['paid','failed','expired'].includes(String(outcome)) || !b.sessionId || !b.sessionId.startsWith('mock_')) throw new StoreError('Invalid simulation.',400,'INVALID_INPUT');
          b = await store.applyStripeEvent({eventId:`mock:${b.id}:${outcome}`,bookingId:b.id,sessionId:b.sessionId,paymentIntentId:`pi_mock_${b.id.replaceAll('-','')}`,livemode:false,amountCents:b.amountCents,currency:'usd',
            paymentStatus:outcome==='paid'?'paid':'unpaid',sessionStatus:outcome==='expired'?'expired':'complete',
            type:outcome==='paid'?'checkout.session.completed':outcome==='expired'?'checkout.session.expired':'checkout.session.async_payment_failed'});
        } else if (['held','awaiting_payment'].includes(b.status)) {
          // Status polling is read-only at Stripe, but can recover a missed webhook durably.
          b = await payments.reconcile(b);
        }
        await deliverConfirmations(store,c);
        const latest = await store.getBooking(b.id) || b;
        const refund = await refunds.getForBooking(latest.id);
        return reply(200,{...publicBooking(latest),refundStatus:refund?.status ?? null,...(c.mock ? {emailStatus:'simulated'} : {})});
      }
      if (route === '/admin/login' && method === 'POST') {
        const email = String(body.email || '').trim().toLowerCase();
        await rate(`login-ip:${ip}`,10,900); await rate(`login-email:${email}`,3,900);
        if (auth.allowEmail(email)) {
          const token = await auth.issueLogin(email); const link = `${c.origin}/igloos/manage#login=${token}`;
          if (c.local && c.mock) return reply(200,{ok:true,devLoginUrl:link});
          await sendEmail(c,email,'Sodus Street booking dashboard sign-in',`Open this one-time link within 15 minutes:\n\n${link}\n\nIf you did not request it, ignore this email.`, `login/${createHash('sha256').update(token).digest('hex')}`);
        }
        return reply(200,{ok:true});
      }
      if (route === '/admin/session' && method === 'POST') {
        await rate(`login-redeem:${ip}`,15,900);
        const session = await auth.redeemLogin(String(body.token || ''));
        if (!session) throw new StoreError('This sign-in link has expired or was already used.',401,'UNAUTHORIZED');
        res.setHeader('Set-Cookie',`${cookieName}=${session}; Path=/api/igloo; HttpOnly; SameSite=Strict; Max-Age=43200${c.local?'':'; Secure'}`);
        return reply(200,{ok:true});
      }
      if (route.startsWith('/admin')) {
        const session = cookie(req); const staffEmail = await auth.sessionEmail(session);
        if (!staffEmail) throw new StoreError('Please sign in to manage bookings.',401,'UNAUTHORIZED');
        if (route === '/admin/logout' && method === 'POST') {
          await auth.logout(session); res.setHeader('Set-Cookie',`${cookieName}=; Path=/api/igloo; HttpOnly; SameSite=Strict; Max-Age=0${c.local?'':'; Secure'}`); return reply(200,{ok:true});
        }
        if (route === '/admin' && method === 'GET') {
          const bookings = (await store.listManagedBookings()).map(({id,slotId,reference,status,name,email,phone,guests,packageName,startsAt,endsAt,amountCents,taxCents,totalCents,currency,emailStatus,createdAt,cancellationRequest,refundedAt})=>({id,slotId,reference,status,name,email,phone,guests,packageName,startsAt,endsAt,amountCents,taxCents,totalCents,currency,emailStatus,createdAt,cancellationRequest,refundedAt}));
          return reply(200,{mode:c.mode,readiness:[...missing,...c.mock?['Local simulation: no Stripe payment or email is sent.']:[]],packages:await store.listPackages(true),slots:await store.listSlots(true),bookings,refundsEnabled:c.mock || c.refundsEnabled===true,refunds:await refunds.list()});
        }
        if (route === '/admin/package' && method === 'POST') { await store.savePackage(body as unknown as PackageInput); return reply(200,{ok:true}); }
        if (route === '/admin/slot' && method === 'POST') { await store.saveSlot(body as unknown as SlotInput); return reply(200,{ok:true}); }
        if (route === '/admin/cancellation-request' && method === 'POST') {
          if (typeof body.bookingId !== 'string' || typeof body.reason !== 'string') throw new StoreError('Provide a booking and cancellation reason.',400,'INVALID_INPUT');
          await store.requestCancellation(body.bookingId,body.reason,staffEmail); return reply(200,{ok:true});
        }
        if (route === '/admin/cancellation-withdraw' && method === 'POST') {
          if (typeof body.bookingId !== 'string' || typeof body.requestId !== 'string') throw new StoreError('Provide a booking and cancellation request.',400,'INVALID_INPUT');
          await store.withdrawCancellation(body.bookingId,body.requestId,staffEmail); return reply(200,{ok:true});
        }
        if (route === '/admin/refund' && method === 'POST') {
          await rate(`refund:${staffEmail}`,20,60);
          if (typeof body.bookingId !== 'string' || typeof body.requestId !== 'string' || typeof body.note !== 'string' || !['weather','venue_closure'].includes(String(body.reason))) throw new StoreError('Provide a booking, request ID, closure reason and staff note.',400,'INVALID_INPUT');
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.bookingId)) throw new StoreError('Booking id must be a UUID.',400,'INVALID_INPUT');
          const b = await store.getBooking(body.bookingId);
          if (b?.status === 'confirmed' && !b.paymentIntentId && !c.mock && c.refundsEnabled) await payments.reconcile(b);
          const refund = await refunds.request({bookingId:body.bookingId,requestId:body.requestId,reason:body.reason as 'weather'|'venue_closure',note:body.note},staffEmail);
          return reply(200,{ok:true,refund});
        }
        if (route === '/admin/refund/reconcile' && method === 'POST') {
          await rate(`refund-check:${staffEmail}`,5,60);
          if (typeof body.bookingId !== 'string') throw new StoreError('Provide a booking.',400,'INVALID_INPUT');
          await refunds.processBooking(body.bookingId);
          await deliverBookingAlerts(store,c);
          return reply(200,{ok:true,refund:await refunds.getForBooking(body.bookingId)});
        }
        if (route === '/admin/reconcile' && method === 'POST') {
          await rate(`reconcile:${ip}`,5,60);
          for (const b of await store.pendingCheckouts(1)) {
            if (b.sessionId) await payments.reconcile(b);
            else if (b.status === 'held') await payments.checkout(b);
          }
          await deliverConfirmations(store,c); await deliverBookingAlerts(store,c); return reply(200,{ok:true});
        }
      }
      reply(404,{error:'Not found.'});
    } catch (error) {
      if (error instanceof StoreError) return reply(error.status,{error:error.message,code:error.code});
      console.error('Igloo request failed:',error instanceof Error ? error.name : 'UnknownError');
      reply(503,{error:'The booking service is temporarily unavailable. Please try again shortly.',code:'SERVICE_UNAVAILABLE'});
    }
  };
}
