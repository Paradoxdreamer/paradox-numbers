# Paradox Numbers

Paradox Telecom Services — virtual number platform.

**Connecting Possibilities. Beyond Boundaries.**

## Stack

- Web: Next.js 15 (App Router) + TypeScript
- API: Fastify + TypeScript
- DB / Auth: Supabase (Postgres + Auth)
- Providers: mock · Telnyx · Twilio
- Monorepo: pnpm + Turbo

## What works

- Email + Google auth, password recovery
- JWT-protected account, search, rentals, messages, billing initiate
- Rental lifecycle: `pending_payment` → `provisioning` → `active` → `released` / `cancelled`
- Pay before provision; only billing webhook activates
- SMS ingest + OTP analysis
- Cancel unpaid / release active (provider + inventory)
- Production env validation on API boot

## Quick start

```bash
pnpm install
cp .env.example .env   # fill required keys — see docs/production.md
supabase db reset      # migrations + seed
pnpm dev
```

- Web: http://localhost:3000  
- API: http://localhost:3001  
- Health: `GET /health`

## What you must supply

All secrets and provider credentials live in `.env` (never commit real values).

See **`.env.example`** and **`docs/production.md`** for the full checklist:

| You provide | Used for |
|-------------|----------|
| Supabase URL + anon + service_role | DB + Auth + JWT verify |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_API_URL` | CORS, OAuth, clients |
| `SMS_WEBHOOK_SECRET` + public webhook URL | Inbound SMS |
| `BILLING_WEBHOOK_SECRET` | Payment confirmation |
| Telnyx **or** Twilio keys | Live numbers |
| Paystack keys (when ready) | Live checkout |

## Docs

- `docs/production.md` — go-live checklist
- `docs/provider-onboarding.md` — Telnyx / Twilio
- `docs/security.md` — auth model
- `docs/architecture.md` — system overview
