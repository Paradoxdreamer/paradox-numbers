# Security

## Current state

- No secrets in the repository. Use `.env.example` only.
- Supabase Auth for user sessions (email + password).
- Browser uses the anon key only.
- API uses the service role key for privileged operations.
- **JWT verification** is enforced on `POST /api/v1/accounts/me`.
  - Client must send `Authorization: Bearer <access_token>`.
  - `userId` is extracted from the verified token — never trusted from the body.
- Webhook signature verification for all provider events (interface ready, not yet wired).

## Auth helper

`apps/api/src/lib/auth.ts` exports `requireUserId(request)`.
Use this on any route that must be authenticated.

## Planned

- Apply `requireUserId` to more routes (rentals, messages, etc.)
- Rate limiting on public endpoints
- Audit logging for admin and sensitive actions
- Row Level Security (RLS) so users can only read their own accounts, rentals, and messages
