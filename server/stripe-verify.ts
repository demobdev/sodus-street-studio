import { readFile, writeFile } from 'node:fs/promises';
import { configuration } from './config.js';
import { createDatabase } from './db.js';
import { IglooStore } from './store.js';
import { Payments } from './payments.js';
const c=configuration(true); c.mock=false;
if(c.mode!=='test'||!c.stripeKey?.match(/^(rk|sk)_test_/)) throw new Error('Sandbox only.');
const fixture=JSON.parse(await readFile('output/igloo-2026-10-15/stripe-smoke.local.json','utf8')) as {bookingId:string;packageId:string;slotId:string};
const db=await createDatabase({connectionString:c.databaseUrl});
try {
  const store=new IglooStore(db); const payments=new Payments(store,c); const b=await store.getBooking(fixture.bookingId);
  if(!b) throw new Error('Test fixture missing.');
  const result=await payments.reconcile(b);
  const proof={account:c.stripeAccount,livemode:result.livemode,status:result.status,reference:result.reference,amountCents:result.amountCents,emailStatus:result.emailStatus,verifiedAt:new Date().toISOString()};
  await writeFile('output/igloo-2026-10-15/stripe-verification.json',JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
  if(result.status==='confirmed') {
    await db.query("UPDATE igloo_packages SET status='draft' WHERE id=$1",[fixture.packageId]);
    await db.query("UPDATE igloo_slots SET status='closed' WHERE id=$1",[fixture.slotId]);
  }
} finally {await db.close();}
