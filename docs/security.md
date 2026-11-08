# Security

- No secrets in the repository. Use `.env.example` only.
- Supabase Auth for user sessions.
- Webhook signature verification for all provider events.
- Rate limiting on public endpoints.
- Audit logging for admin and sensitive actions.