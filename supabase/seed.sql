-- Seed basic providers
INSERT INTO providers (name) VALUES
  ('telnyx'),
  ('twilio')
ON CONFLICT (name) DO NOTHING;