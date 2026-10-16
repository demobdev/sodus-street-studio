import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { AdminAuth } from './auth.js';
import type { Queryable } from './db.js';

const SECRET = 'local-test-auth-secret-with-at-least-thirty-two-characters';
const ADMIN = 'maat@example.test';

async function fixture() {
  const pg = await PGlite.create();
  await pg.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const db: Queryable = {
    async query<T>(sql: string, parameters: unknown[] = []) {
      const result = await pg.query<T>(sql, parameters);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
  };
  return { pg, db, auth: new AdminAuth(db, SECRET, [ADMIN]) };
}

test('admin login normalizes allowlisted email, hashes credentials, and only redeems once', async () => {
  const { pg, auth } = await fixture();
  try {
    assert.equal(auth.allowEmail(' MAAT@EXAMPLE.TEST '), true);
    assert.equal(auth.allowEmail('stranger@example.test'), false);
    await assert.rejects(auth.issueLogin('stranger@example.test'));
    const token = await auth.issueLogin(' MAAT@EXAMPLE.TEST ');
    const stored = await pg.query<{ token_hash: string; email: string; lifetime: number }>(
      'SELECT token_hash, email, EXTRACT(EPOCH FROM expires_at - now()) AS lifetime FROM igloo_admin_tokens',
    );
    assert.equal(stored.rows[0]!.email, ADMIN);
    assert.notEqual(stored.rows[0]!.token_hash, token);
    assert.ok(Number(stored.rows[0]!.lifetime) > 895 && Number(stored.rows[0]!.lifetime) <= 900);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => auth.redeemLogin(token)));
    const sessions = concurrent.filter((value): value is string => value !== null);
    assert.equal(sessions.length, 1);
    assert.equal(await auth.sessionEmail(sessions[0]!), ADMIN);
    assert.equal(await auth.sessionEmail(token), null, 'login tokens cannot be used as sessions');
    assert.equal(await auth.redeemLogin(sessions[0]!), null, 'sessions cannot be used as login links');
    assert.equal(await auth.redeemLogin(token), null);
    const sessionRows = await pg.query<{ token_hash: string; lifetime: number }>(
      'SELECT token_hash, EXTRACT(EPOCH FROM expires_at - now()) AS lifetime FROM igloo_admin_sessions',
    );
    assert.notEqual(sessionRows.rows[0]!.token_hash, sessions[0]);
    assert.ok(Number(sessionRows.rows[0]!.lifetime) > 43_195 && Number(sessionRows.rows[0]!.lifetime) <= 43_200);
    await auth.logout(sessions[0]!);
    assert.equal(await auth.sessionEmail(sessions[0]!), null);
  } finally {
    await pg.close();
  }
});

test('expired tokens and sessions fail, and removing the allowlist revokes existing access', async () => {
  const { pg, db, auth } = await fixture();
  try {
    const expired = await auth.issueLogin(ADMIN);
    await pg.query("UPDATE igloo_admin_tokens SET expires_at = now() - interval '1 second'");
    assert.equal(await auth.redeemLogin(expired), null);
    const token = await auth.issueLogin(ADMIN);
    const revoked = new AdminAuth(db, SECRET, []);
    assert.equal(await revoked.redeemLogin(token), null);
    const session = await auth.redeemLogin(token);
    assert.ok(session);
    assert.equal(await revoked.sessionEmail(session), null);
    assert.equal(await new AdminAuth(db, `${SECRET}-rotated`, [ADMIN]).sessionEmail(session), null);
    await pg.query("UPDATE igloo_admin_sessions SET expires_at = now() - interval '1 second'");
    assert.equal(await auth.sessionEmail(session), null);
    assert.equal(await auth.redeemLogin('bad-token'), null);
    assert.equal(await auth.sessionEmail('bad-token'), null);
  } finally {
    await pg.close();
  }
});

test('a failed session insert rolls back login token consumption', async () => {
  const { pg, auth } = await fixture();
  try {
    const token = await auth.issueLogin(ADMIN);
    await pg.query('ALTER TABLE igloo_admin_sessions ADD CONSTRAINT refuse_session CHECK (false)');
    await assert.rejects(auth.redeemLogin(token));
    const consumed = await pg.query<{ consumed_at: string | null }>('SELECT consumed_at FROM igloo_admin_tokens');
    assert.equal(consumed.rows[0]!.consumed_at, null);
    await pg.query('ALTER TABLE igloo_admin_sessions DROP CONSTRAINT refuse_session');
    assert.ok(await auth.redeemLogin(token));
  } finally {
    await pg.close();
  }
});

test('rate limit is atomic, durable across instances, private, and resets after its window', async () => {
  const { pg, db, auth } = await fixture();
  try {
    const secondInstance = new AdminAuth(db, SECRET, [ADMIN]);
    const outcomes = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      (index % 2 ? auth : secondInstance).limit(`login:email:${ADMIN}`, 3, 60)));
    assert.equal(outcomes.filter(Boolean).length, 3);
    assert.equal(await secondInstance.limit(`login:email:${ADMIN}`, 3, 60), false);
    const rows = await pg.query<{ key: string }>('SELECT key FROM igloo_rate_limits');
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0]!.key.includes(ADMIN), false);
    assert.equal(await auth.limit('login:email:another@example.test', 3, 60), true);
    await pg.query("UPDATE igloo_rate_limits SET window_start = now() - interval '61 seconds'");
    assert.equal(await auth.limit(`login:email:${ADMIN}`, 3, 60), true);
    await assert.rejects(auth.limit('', 3, 60));
    await assert.rejects(auth.limit('bad', 0, 60));
    await assert.rejects(auth.limit('bad', 3, 0));
    assert.throws(() => new AdminAuth(db, 'short-secret', [ADMIN]));
  } finally {
    await pg.close();
  }
});
