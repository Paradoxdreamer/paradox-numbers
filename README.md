# Paradox Numbers

Paradox Telecom Services — Flagship virtual number platform.

**Connecting Possibilities. Beyond Boundaries.**

## Stack

- Frontend: Next.js 15 (App Router) + TypeScript
- Backend: Fastify + TypeScript
- Database: Supabase / PostgreSQL
- Auth: Supabase Auth (email + password) + JWT verification on API
- Monorepo: pnpm + Turbo

## What works today

1. **Sign up / Sign in** with email + password (Supabase Auth)
2. Automatic account creation + linking on first login
3. **JWT-protected** account resolution (`/accounts/me`)
4. Search available US numbers (mock provider)
5. Rent a number → provisioned + persisted
6. View your rentals
7. Ingest inbound SMS via webhook

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/accounts` | Create account |
| `POST /api/v1/accounts/me` | Resolve/create account (**requires JWT**) |
| `GET /api/v1/numbers/search` | Search available numbers |
| `POST /api/v1/rentals` | Rent + provision a number |
| `GET /api/v1/accounts/:id/rentals` | List rentals |
| `POST /api/v1/webhooks/sms` | Ingest incoming SMS |
| `GET /api/v1/rentals/:id/messages` | Message history |

## Getting Started

```bash
# 1. Install
pnpm install

# 2. Environment
cp .env.example .env
# Required:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# 3. Database
supabase db reset   # applies migration + seed

# 4. Run both apps
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Structure

```
apps/
  api/          Fastify backend
  web/          Next.js customer UI (Auth + search/rent)
packages/
  shared/       Domain types
supabase/       Migrations + seed
docs/
```

## Team priorities (next)

1. Apply JWT protection to more routes (rentals, messages)
2. Real providers — Telnyx / Twilio adapters
3. Message inbox UI + number details + cancel flow
4. Payments — Paystack
5. RLS policies

See `/docs/architecture.md` and `/docs/security.md`.
