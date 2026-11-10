-- Expand rental lifecycle states
-- pending_payment → provisioning → active → past_due / suspended / released

ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_status_check;

ALTER TABLE rentals
  ADD CONSTRAINT rentals_status_check
  CHECK (status IN (
    'pending_payment',
    'provisioning',
    'active',
    'past_due',
    'suspended',
    'released',
    'cancelled',
    'expired'
  ));

-- Default new rentals to pending_payment
ALTER TABLE rentals ALTER COLUMN status SET DEFAULT 'pending_payment';
