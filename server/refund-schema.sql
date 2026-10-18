CREATE TABLE IF NOT EXISTS igloo_refund_operations (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL UNIQUE REFERENCES igloo_bookings(id),
  request_id uuid NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('weather','venue_closure')),
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 1000),
  actor text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 50),
  currency text NOT NULL CHECK (currency = 'usd'),
  payment_intent_id text NOT NULL,
  livemode boolean NOT NULL,
  refund_id text UNIQUE,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pending','succeeded','failed','needs_review')),
  attempted_at timestamptz,
  last_checked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_check_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  lease_until timestamptz,
  error text,
  CHECK ((claim_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS igloo_refund_operations_pending
  ON igloo_refund_operations(next_check_at) WHERE status IN ('requested','pending');
CREATE TABLE IF NOT EXISTS igloo_refund_events (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES igloo_refund_operations(id),
  kind text NOT NULL,
  stripe_event_id text UNIQUE,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
