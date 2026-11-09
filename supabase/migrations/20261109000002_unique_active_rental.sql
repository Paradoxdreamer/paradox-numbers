-- Prevent two active rentals on the same number
CREATE UNIQUE INDEX IF NOT EXISTS idx_rentals_active_number
  ON rentals(number_id)
  WHERE status IN ('pending', 'active', 'past_due');
