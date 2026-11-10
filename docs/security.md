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
| `POST /api/v1/billing/initiate/:rentalId` | JWT + membership of rental's account; amount is read from server-side inventory |

### Paystack payment controls

- Checkout is initialized server-side with the Paystack secret key. The browser receives only the hosted authorization URL.
- The webhook verifies Paystack's signature against the exact raw JSON bytes. Current `Paystack-Signature` signing-secret format is supported with a 5-minute timestamp window; legacy `x-paystack-signature` is supported using the Paystack secret key.
- A successful webhook is independently checked against Paystack's transaction verification API.
- The verified reference, amount, currency, status, and rental metadata must match the pending payment before it is marked successful.
- Duplicate references are looked up against the existing payment record; a duplicate event does not create a second payment.
- Never expose `PAYSTACK_SECRET_KEY` or `PAYSTACK_WEBHOOK_SECRET` to the browser.

### Still open

- Durable provisioning reconciliation/retry after a payment succeeds but telecom provisioning fails. Do not retry provider provisioning blindly until the provider operation has an idempotency strategy.
- Message list/webhook authorization (webhook stays public by design; list should be protected).
- Rate limiting.
- Audit logging.
- Row Level Security (RLS).
- Automated API tests and CI checks.
