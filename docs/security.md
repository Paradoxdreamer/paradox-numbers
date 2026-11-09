# Security

## Current state

- No secrets in the repository. Use `.env.example` only.
- Supabase Auth for user sessions (email + password).
- Browser uses the anon key only.
- API uses the service role key for privileged operations.
- **JWT verification** via `requireUserId(request)` in `apps/api/src/lib/auth.ts`.

### Protected routes

| Route | Protection |
|-------|------------|
| `POST /api/v1/accounts/me` | JWT required. userId from token. |
| `POST /api/v1/rentals` | JWT required. Account resolved from token (body accountId ignored). |
| `GET /api/v1/accounts/:id/rentals` | JWT + account membership |
| `GET /api/v1/rentals/:id` | JWT + membership of rental's account |

### Still open

- Message list/webhook endpoints (webhook stays public by design; list should be protected)
- Rate limiting
- Audit logging
- Row Level Security (RLS)
