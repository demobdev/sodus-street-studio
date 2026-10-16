import { createHmac, randomBytes } from 'node:crypto';
import type { Queryable } from './db.js';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Tokens are opaque, short lived, and stored only as keyed hashes. */
export class AdminAuth {
  private readonly emails: Set<string>;

  constructor(
    private readonly db: Queryable,
    private readonly secret: string,
    adminEmails: readonly string[],
  ) {
    if (secret.length < 32) throw new Error('Admin authentication requires a secret of at least 32 characters.');
    this.emails = new Set(adminEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  }

  allowEmail(email: string): boolean {
    return this.emails.has(email.trim().toLowerCase());
  }

  private hash(kind: 'login' | 'session' | 'limit', value: string): string {
    return createHmac('sha256', this.secret).update(`${kind}:${value}`).digest('hex');
  }

  async issueLogin(email: string): Promise<string> {
    const normalized = email.trim().toLowerCase();
    if (!this.allowEmail(normalized)) throw new Error('Admin access is unavailable.');
    const token = randomBytes(32).toString('base64url');
    await this.db.query(
      `INSERT INTO igloo_admin_tokens (token_hash, email, expires_at)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [this.hash('login', token), normalized],
    );
    return token;
  }

  async redeemLogin(token: string): Promise<string | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    const session = randomBytes(32).toString('base64url');
    // A single statement makes consumption and session creation atomic, including
    // concurrent requests using the same link and failures inserting the session.
    const result = await this.db.query<{ email: string }>(
      `WITH consumed AS (
         UPDATE igloo_admin_tokens SET consumed_at = now()
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
           AND email = ANY($3::text[])
         RETURNING email
       )
       INSERT INTO igloo_admin_sessions (token_hash, email, expires_at)
       SELECT $2, email, now() + interval '12 hours' FROM consumed
       RETURNING email`,
      [this.hash('login', token), this.hash('session', session), [...this.emails]],
    );
    return result.rows.length === 1 ? session : null;
  }

  async sessionEmail(token: string): Promise<string | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    const result = await this.db.query<{ email: string }>(
      `SELECT email FROM igloo_admin_sessions
       WHERE token_hash = $1 AND expires_at > now() AND email = ANY($2::text[])`,
      [this.hash('session', token), [...this.emails]],
    );
    return result.rows[0]?.email ?? null;
  }

  async logout(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    await this.db.query('DELETE FROM igloo_admin_sessions WHERE token_hash = $1', [this.hash('session', token)]);
  }

  /** Atomic fixed-window limiter shared across instances. True permits the request. */
  async limit(key: string, max: number, windowSeconds: number): Promise<boolean> {
    if (!key || key.length > 2048 || !Number.isSafeInteger(max) || max < 1 || max > 1_000_000
      || !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86_400) {
      throw new Error('Invalid rate limit configuration.');
    }
    const result = await this.db.query<{ hits: number }>(
      `INSERT INTO igloo_rate_limits (key, hits, window_start) VALUES ($1, 1, now())
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE
           WHEN igloo_rate_limits.window_start <= now() - ($2 * interval '1 second') THEN 1
           ELSE LEAST(igloo_rate_limits.hits + 1, $3 + 1)
         END,
         window_start = CASE
           WHEN igloo_rate_limits.window_start <= now() - ($2 * interval '1 second') THEN now()
           ELSE igloo_rate_limits.window_start
         END
       RETURNING hits`,
      [this.hash('limit', key), windowSeconds, max],
    );
    return result.rows[0]!.hits <= max;
  }
}
