import { createHmac, timingSafeEqual } from 'node:crypto';
export function bookingToken(id: string, secret: string) {
  return `${id}.${createHmac('sha256', secret).update(`booking:${id}`).digest('base64url')}`;
}
export function bookingId(token: string, secret: string): string | null {
  if (secret.length < 32 || token.length > 150) return null;
  const [id] = token.split('.');
  if (!/^[0-9a-f-]{36}$/.test(id || '')) return null;
  const expected = Buffer.from(bookingToken(id, secret)); const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}
