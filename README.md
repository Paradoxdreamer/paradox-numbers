# Paradox Numbers

Paradox Telecom Services — Flagship virtual number platform.

**Connecting Possibilities. Beyond Boundaries.**

## Stack

- Frontend: Next.js 15 (App Router) + TypeScript
- Backend: Fastify + TypeScript
- Database: Supabase / PostgreSQL
- Auth: Supabase Auth (next)
- Monorepo: pnpm + Turbo

## What works today (vertical slice)

1. Create an account
2. Search available US numbers (mock provider)
3. Rent a number → provisioned + persisted
4. View your rentals
5. Ingest inbound SMS via webhook

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/accounts` | Create personal/business account |
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
# Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (and the NEXT_PUBLIC_* keys)

# 3. Database
supabase db reset   # applies migration + seed (includes mock provider)

# 4. Run both apps
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Structure

```
apps/
  api/          Fastify backend (modules: accounts, numbers, rentals, messages, telecom)
  web/          Next.js customer UI
packages/
  shared/       Domain types
supabase/       Migrations + seed
docs/           Architecture, security, provider notes
```

## Team priorities (next)

1. **Auth** — Supabase Auth + link users to accounts + protect routes
2. **Real providers** — Telnyx / Twilio adapters (interface already ready)
3. **Dashboard polish** — message inbox, number details, cancel flow
4. **Payments** — Paystack (keys already in .env.example)
5. **RLS** — move off service-role for user-facing reads

See `/docs/architecture.md` for ownership of the data layer.
