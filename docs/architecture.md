# Architecture

Modular monolith.

## Apps

- `apps/web` — Next.js customer surface (search → rent). Admin routes will live here under protected paths.
- `apps/api` — Fastify backend. Modules own their routes + services.

## Packages

- `packages/shared` — Domain types shared by API and web.

## API modules

| Module | Responsibility |
|--------|----------------|
| `accounts` | Create/get accounts, optional user linking |
| `numbers` | Provider search + inventory sync |
| `rentals` | Provision + persist rentals |
| `messages` | Inbound SMS webhook + history |
| `telecom` | Provider-agnostic interface + adapters |

## Data flow (happy path)

```
Web → POST /accounts
Web → GET  /numbers/search   → NumbersService → MockProvider (+ inventory insert)
Web → POST /rentals          → RentalsService → provision → rentals row + status=assigned
Provider → POST /webhooks/sms → MessagesService → messages row
```

All DB access currently uses the service-role Supabase client (`apps/api/src/lib/supabase.ts`).
Auth + RLS come next.

## Provider contract

See `apps/api/src/modules/telecom/provider.interface.ts`.
Real adapters must implement `TelecomProvider` (and later `WebhookVerifier`).
