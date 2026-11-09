# Security

## Current state

- No secrets in the repository. Use `.env.example` only.
- Supabase Auth for user sessions (email + password).
- Browser uses the anon key only.
- API uses the service role key for privileged operations.
- Webhook signature verification for all provider events (interface ready, not yet wired).

## Known gap (next sprint)

`POST /api/v1/accounts/me` currently trusts the `userId` sent from the client.

**Next step:** Verify the Supabase JWT on the API and extract `userId` from the token instead of the body. This is the highest priority security item.

## Planned

- Rate limiting on public endpoints
- Audit logging for admin and sensitive actions
- Row Level Security (RLS) so users can only read their own accounts, rentals, and messages
