-- Message idempotency: prevent duplicate webhook deliveries
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_id
  ON messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
