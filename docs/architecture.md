# Architecture

Modular monolith.

- `apps/web` — Next.js customer + business dashboard (includes protected admin routes)
- `apps/api` — Fastify backend
- `packages/*` — Shared code (database, contracts, validation, ui, shared)
- Provider adapter pattern lives under `apps/api/src/modules/telecom`

Admin dashboard will live inside `apps/web` under protected routes to avoid duplication.