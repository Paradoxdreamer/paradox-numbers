-- Seed basic providers
INSERT INTO providers (name) VALUES
  ('mock'),
  ('telnyx'),
  ('twilio')
ON CONFLICT (name) DO NOTHING;
