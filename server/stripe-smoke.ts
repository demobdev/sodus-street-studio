/** Explicit sandbox smoke test. Never invokes a live key or sends email. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { configuration } from './config.js';
import { createDatabase } from './db.js';
import { IglooStore } from './store.js';
import { Payments } from './payments.js';
const c = configuration(true);
if (c.mode !== 'test' || !c.stripeKey?.match(/^(rk|sk)_test_/) || !c.databaseUrl || !c.stripeAccount) throw new Error('Explicit sandbox key, account and development database required.');
c.mock = false;
const db = await createDatabase({connectionString:c.databaseUrl});
try {
  const store = new IglooStore(db); await store.init(); const payments = new Payments(store,c); await payments.verifyAccount();
  const p = await store.savePackage({name:'Sandbox integration test — not for sale',description:'A $1 test fixture; not an approved igloo package.',durationMinutes:90,amountCents:100,currency:'usd',maxGuests:1,policyText:'Stripe sandbox test only. No real payment or reservation.',status:'active'});
  const start = Date.now() + 30*24*60*60_000;
  const slot = await store.saveSlot({startsAt:new Date(start).toISOString(),endsAt:new Date(start+90*60_000).toISOString(),capacity:1,status:'open'});
  const b = await store.createHold({packageId:p.id,slotId:slot.id,name:'Sandbox Tester',email:'booking-test@example.com',guests:1,policyAccepted:true,requestId:randomUUID()},{livemode:false});
  const checkout = await payments.checkout(b);
  await mkdir('output/igloo-2026-10-15',{recursive:true});
  await writeFile('output/igloo-2026-10-15/stripe-smoke.local.json',JSON.stringify({bookingId:b.id,packageId:p.id,slotId:slot.id,sessionId:checkout.sessionId,checkoutUrl:checkout.checkoutUrl},null,2));
  console.log(JSON.stringify({accountVerified:true,mode:'sandbox',checkoutCreated:!!checkout.sessionId,amountCents:checkout.amountCents,reference:checkout.reference}));
} finally { await db.close(); }
