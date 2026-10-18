export type BookingMode = 'test' | 'live' | 'unconfigured'

export type IglooPackage = {
  id: string
  name: string
  description: string
  durationMinutes: number
  amountCents: number
  currency: 'usd'
  maxGuests: number
  policyText: string
  status: 'draft' | 'active'
}

export type IglooSlot = {
  id: string
  startsAt: string
  endsAt: string
  capacity: number
  remaining: number
  status: 'open' | 'closed'
}

export type IglooCatalog = {
  mode: BookingMode
  bookingOpen: boolean
  notice: string
  packages: IglooPackage[]
  slots: IglooSlot[]
}

export type BookingStatus = 'held' | 'awaiting_payment' | 'confirmed' | 'expired' | 'cancelled' | 'needs_review'

export type IglooBooking = {
  mode: BookingMode
  reference: string
  status: BookingStatus
  packageName: string
  startsAt: string
  endsAt: string
  guests: number
  amountCents: number
  taxCents: number
  totalCents: number
  currency: string
  emailStatus: string
  refundedAt: string | null
  refundStatus: RefundOperation['status'] | null
  checkoutUrl?: string
}

export type AdminBooking = Omit<IglooBooking, 'mode' | 'checkoutUrl' | 'refundStatus'> & {
  id: string
  slotId: string
  name: string
  email: string
  phone: string
  createdAt: string
  cancellationRequest: {
    id: string
    reason: string
    requestedBy: string
    requestedAt: string
  } | null
}

export type RefundOperation = {
  id: string
  bookingId: string
  requestId: string
  reason: 'weather' | 'venue_closure'
  note: string
  actor: string
  amountCents: number
  currency: string
  status: 'requested' | 'pending' | 'succeeded' | 'failed' | 'needs_review'
  refundId: string | null
  attemptedAt: string | null
  completedAt: string | null
  createdAt: string
  error: string | null
}

export type IglooAdminData = {
  mode: BookingMode
  readiness: string[]
  packages: IglooPackage[]
  slots: IglooSlot[]
  bookings: AdminBooking[]
  refundsEnabled: boolean
  refunds: RefundOperation[]
}

export class IglooApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'IglooApiError'
    this.status = status
    this.code = code
  }
}

export async function iglooApi<T>(path: string, options: {
  body?: unknown
  token?: string
  signal?: AbortSignal
} = {}): Promise<T> {
  const response = await fetch(`/api/igloo${path}`, {
    method: options.body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: options.signal,
    cache: 'no-store',
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = payload as { error?: unknown; code?: unknown } | null
    throw new IglooApiError(
      typeof error?.error === 'string' ? error.error : 'Booking is temporarily unavailable. Please try again.',
      response.status,
      typeof error?.code === 'string' ? error.code : undefined,
    )
  }
  if (payload === null) throw new IglooApiError('We could not load the booking service. Please try again.', 503)
  return payload as T
}

export function money(amountCents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100)
}

export function eventDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
}

export function eventTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value))
}

const eventInputFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function eventTimeInput(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const parts = Object.fromEntries(eventInputFormatter.formatToParts(new Date(value)).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function parseEventTime(value: string): { iso: string; error: string } {
  const invalid = { iso: '', error: 'Choose a valid New York date and time.' }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return invalid
  const naive = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) return invalid

  // Sampling either side captures both offsets when the clocks change. Match the
  // original wall time so gaps and repeated times cannot silently move a booking.
  const offsets = new Set([-1, 0, 1].map(day => {
    const instant = naive + day * 86_400_000
    return Date.parse(`${eventTimeInput(new Date(instant).toISOString())}:00Z`) - instant
  }))
  const matches = [...offsets].map(offset => new Date(naive - offset).toISOString())
    .filter(iso => eventTimeInput(iso) === value)
  if (matches.length === 0) return { iso: '', error: 'This New York time does not exist because the clocks move forward. Choose another time.' }
  if (matches.length > 1) return { iso: '', error: 'This New York time occurs twice when the clocks move back. Choose a time outside the repeated hour.' }
  return { iso: matches[0], error: '' }
}

export function matchesDuration(slot: IglooSlot, packageItem: IglooPackage) {
  return Date.parse(slot.endsAt) - Date.parse(slot.startsAt) === packageItem.durationMinutes * 60_000
}

export function isLocalBookingHost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

export function safeCheckoutUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.username && !url.password) {
      return url.href
    }
    if (isLocalBookingHost() && url.origin === window.location.origin && url.pathname === '/igloos/test-checkout') {
      return url.href
    }
  } catch { /* Invalid checkout URLs are never followed. */ }
  return null
}

const bookingTokenKey = 'sodus.igloo.booking-token'

export function saveBookingToken(token: string) {
  try { sessionStorage.setItem(bookingTokenKey, token) } catch { /* The return URL still carries the token. */ }
}

export function readBookingToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  if (token) {
    saveBookingToken(token)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    return token
  }
  try { return sessionStorage.getItem(bookingTokenKey) || '' } catch { return '' }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
