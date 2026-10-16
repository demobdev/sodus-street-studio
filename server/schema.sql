CREATE TABLE IF NOT EXISTS igloo_packages (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  amount_cents integer NOT NULL CHECK (amount_cents >= 50),
  currency text NOT NULL CHECK (currency = 'usd'),
  max_guests integer NOT NULL CHECK (max_guests > 0),
  policy_text text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS igloo_slots (
  id uuid PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS igloo_bookings (
  id uuid PRIMARY KEY,
  reference text UNIQUE NOT NULL,
  request_id uuid UNIQUE NOT NULL,
  request_fingerprint text NOT NULL,
  package_id uuid NOT NULL REFERENCES igloo_packages(id),
  slot_id uuid NOT NULL REFERENCES igloo_slots(id),
  status text NOT NULL CHECK (status IN ('held', 'awaiting_payment', 'confirmed', 'expired', 'cancelled', 'needs_review')),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  guests integer NOT NULL CHECK (guests > 0),
  package_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 50),
  currency text NOT NULL CHECK (currency = 'usd'),
  policy_text text NOT NULL,
  policy_accepted_at timestamptz NOT NULL DEFAULT now(),
  livemode boolean NOT NULL,
  session_id text UNIQUE,
  checkout_url text,
  expires_at timestamptz,
  checkout_params jsonb,
  checkout_attempted_at timestamptz,
  review_reason text,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE igloo_bookings ADD COLUMN IF NOT EXISTS tax_rate_id text;
ALTER TABLE igloo_bookings ADD COLUMN IF NOT EXISTS tax_percentage numeric(7,4) CHECK (tax_percentage >= 0 AND tax_percentage <= 100);
ALTER TABLE igloo_bookings ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0);
ALTER TABLE igloo_bookings ADD COLUMN IF NOT EXISTS total_cents integer CHECK (total_cents = amount_cents + tax_cents);
CREATE INDEX IF NOT EXISTS igloo_bookings_slot_status ON igloo_bookings(slot_id, status);
CREATE TABLE IF NOT EXISTS igloo_payment_events (
  event_id text PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES igloo_bookings(id),
  session_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS igloo_outbox (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL UNIQUE REFERENCES igloo_bookings(id),
  kind text NOT NULL DEFAULT 'booking_confirmation' CHECK (kind = 'booking_confirmation'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE TABLE IF NOT EXISTS igloo_admin_tokens (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS igloo_admin_sessions (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS igloo_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  window_start timestamptz NOT NULL
);
