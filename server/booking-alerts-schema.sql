CREATE TABLE IF NOT EXISTS igloo_booking_alerts (
  id uuid PRIMARY KEY,
  event_key text NOT NULL,
  booking_id uuid NOT NULL REFERENCES igloo_bookings(id),
  kind text NOT NULL CHECK (kind IN ('staff_booking','guest_refund','staff_refund_review')),
  recipient text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload->'subject') = 'string' AND jsonb_typeof(payload->'text') = 'string'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key,recipient),
  CHECK ((claim_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS igloo_booking_alerts_pending
  ON igloo_booking_alerts(next_attempt_at,created_at) WHERE status IN ('pending','failed','sending');
