# Architecture

Modular monolith.

- `apps/web` — Next.js customer + business dashboard (includes protected admin routes)
- `apps/api` — Fastify backend
- `packages/*` — Shared code (database, contracts, validation, ui, shared)
- Provider adapter pattern lives under `apps/api/src/modules/telecom`

## Data layer (current)

- **NumbersService** — searches providers and keeps a local inventory in `numbers`
- **RentalsService** — provisions via provider + inserts rental + marks number assigned
- **MessagesService** — stores inbound SMS linked to the correct rental/number

All DB access goes through the service-role Supabase client in `apps/api/src/lib/supabase.ts`.

## Webhook flow

```
Provider → POST /api/v1/webhooks/sms → MessagesService.storeIncoming → messages table
```

Signature verification will be added when real providers are wired (see `WebhookVerifier`).

Admin dashboard will live inside `apps/web` under protected routes to avoid duplication.
