# Architecture

Modular monolith.

## Apps

- `apps/web` — Next.js customer surface (Auth + search → rent)
- `apps/api` — Fastify backend. Modules own their routes + services.

## Packages

- `packages/shared` — Domain types shared by API and web.

## API modules

| Module | Responsibility |
|--------|----------------|
| `accounts` | Create/get accounts, get-or-create for authenticated user |
| `numbers` | Provider search + inventory sync |
| `rentals` | Provision + persist rentals |
| `messages` | Inbound SMS webhook + history |
| `telecom` | Provider-agnostic interface + adapters |

## Auth + account flow

```
User signs up / signs in (Supabase Auth)
  → onAuthStateChange fires
  → Web calls POST /api/v1/accounts/me { userId, name }
  → AccountsService.getOrCreateForUser()
      - finds existing account_users link, or
      - creates personal account + owner link
  → Web receives account and loads rentals
```

**Note:** JWT verification on the API is the next security step.

## Data flow (happy path)

```
Web → Auth (Supabase)
Web → POST /accounts/me
Web → GET  /numbers/search   → NumbersService → MockProvider (+ inventory insert)
Web → POST /rentals          → RentalsService → provision → rentals row + status=assigned
Provider → POST /webhooks/sms → MessagesService → messages row
```

All DB access currently uses the service-role Supabase client (`apps/api/src/lib/supabase.ts`).

## Provider contract

See `apps/api/src/modules/telecom/provider.interface.ts`.
Real adapters must implement `TelecomProvider` (and later `WebhookVerifier`).
