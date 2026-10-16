import { createDatabase } from './db.js';
import { IglooStore } from './store.js';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required.');
const db = await createDatabase({connectionString:process.env.DATABASE_URL});
try { await new IglooStore(db).init(); console.log('Booking schema ready; no packages, prices or sales enabled.'); }
finally { await db.close(); }
