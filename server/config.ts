export interface Config {
  local: boolean; mock: boolean; mode: 'test' | 'live'; liveAllowed: boolean;
  origin: string; secret: string; databaseUrl?: string; stripeKey?: string; webhookSecret?: string;
  stripeAccount?: string; stripeTaxRateId?: string; taxApproved?: boolean; policyApproved?: boolean;
  adminEmails: string[]; emailKey?: string; emailFrom?: string; emailEnabled: boolean; emailReplyTo?: string; cronSecret?: string;
}
export function configuration(localListener = false, env = process.env): Config {
  const local = localListener && !env.VERCEL && env.NODE_ENV !== 'production';
  const mock = local && env.PAYMENTS_DRIVER === 'mock';
  const origin = new URL(env.APP_ORIGIN || (local ? 'http://127.0.0.1:5173' : 'https://sodusstreetstudio.com')).origin;
  if (!local && !origin.startsWith('https://')) throw new Error('APP_ORIGIN must use HTTPS.');
  return { local, mock, origin, mode: env.IGLOO_MODE === 'live' ? 'live' : 'test',
    liveAllowed: env.IGLOO_ALLOW_LIVE === 'true', secret: env.BOOKING_TOKEN_SECRET || '',
    databaseUrl: env.DATABASE_URL, stripeKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeAccount: env.STRIPE_ACCOUNT_ID,
    stripeTaxRateId: env.STRIPE_TAX_RATE_ID, taxApproved: env.IGLOO_TAX_APPROVED === 'true',
    policyApproved: env.IGLOO_POLICY_APPROVED === 'true', cronSecret: env.CRON_SECRET,
    adminEmails: (env.BOOKING_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    emailKey: env.RESEND_API_KEY, emailFrom: env.BOOKING_FROM_EMAIL,
    emailReplyTo: env.BOOKING_REPLY_TO || 'maat@onthemovecs.com',
    emailEnabled: env.BOOKING_EMAIL_ENABLED === 'true' && !mock };
}
export function readiness(c: Config): string[] {
  const missing: string[] = [];
  if (!c.mock && !c.databaseUrl) missing.push('Booking database connection');
  if (c.secret.length < 32) missing.push('Booking security secret');
  if (!c.mock && !c.stripeKey) missing.push('Stripe API connection');
  if (!c.mock && !c.webhookSecret) missing.push('Stripe webhook verification');
  if (!c.mock && !c.stripeAccount) missing.push('Expected Stripe account ID');
  if (c.mock && c.mode === 'live') missing.push('Local simulation cannot accept live payments');
  if (c.stripeKey && !c.stripeKey.startsWith(c.mode === 'live' ? 'rk_live_' : 'rk_test_') && !c.stripeKey.startsWith(c.mode === 'live' ? 'sk_live_' : 'sk_test_')) missing.push('Stripe key does not match payment mode');
  if (c.mode === 'live' && !c.liveAllowed) missing.push('Customer booking launch');
  if (c.mode === 'live' && !c.policyApproved) missing.push('Approved igloo cancellation, weather and rescheduling policy');
  if (c.mode === 'live' && (!c.taxApproved || !c.stripeTaxRateId)) missing.push('Approved exclusive sales-tax rate');
  if (!c.mock && (!c.emailEnabled || !c.emailKey || !c.emailFrom)) missing.push('Verified confirmation email sender');
  return missing;
}
