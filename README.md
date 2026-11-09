# Paradox Numbers

Paradox Telecom Services — Flagship virtual number platform.

**Connecting Possibilities. Beyond Boundaries.**

## Stack

- Frontend: Next.js (App Router) + TypeScript
- Backend: Fastify + TypeScript
- Database: Supabase / PostgreSQL
- Auth: Supabase Auth
- Monorepo: pnpm + Turbo

## Current capabilities (API)

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/v1/numbers/search` | Search available numbers (mock provider) |
| `POST /api/v1/rentals` | Create rental (provisions + persists) |
| `GET /api/v1/accounts/:accountId/rentals` | List rentals for an account |
| `GET /api/v1/rentals/:rentalId` | Get single rental |
| `POST /api/v1/webhooks/sms` | Ingest incoming SMS |
| `GET /api/v1/rentals/:rentalId/messages` | List messages for a rental |

## Getting Started

```bash
# 1. Install
pnpm install

# 2. Copy env and fill Supabase credentials
cp .env.example .env

# 3. Apply migrations + seed (requires supabase CLI)
supabase db reset   # or push the migration + seed manually

# 4. Run
pnpm dev
```

API runs on `http://localhost:3001` by default.

## Structure

See `/docs/architecture.md` for the modular layout and data-flow notes.

## Team notes

- Real providers (Telnyx / Twilio) should implement `TelecomProvider` + `WebhookVerifier`.
- Auth + RLS policies are next (currently using service-role for simplicity).
- Frontend dashboard can start consuming the endpoints above immediately.
