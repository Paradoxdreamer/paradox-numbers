# Production checklist

## What you must provide (fill `.env`)

| Variable | Where to get it | Required |
|----------|-----------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | **Yes** |
| `SUPABASE_URL` | Same as above | **Yes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role (server only) | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Public web URL (`https://app.yoursite.com`) | **Yes** in prod |
| `NEXT_PUBLIC_API_URL` | Public API (`https://api.yoursite.com/api/v1`) | **Yes** |
| `SMS_WEBHOOK_SECRET` | Generate a long random string (≥16 chars) | **Yes** in prod |
| `BILLING_WEBHOOK_SECRET` | Generate a long random string (≥16 chars) | **Yes** in prod |
| `SMS_WEBHOOK_URL` | Public API webhook URL | **Yes** for live SMS |
| `TELECOM_PROVIDER` | `mock` \| `telnyx` \| `twilio` | Default `mock` |
| `TELNYX_API_KEY` | Telnyx Mission Control | If `telnyx` |
| `TELNYX_MESSAGING_PROFILE_ID` | Telnyx Messaging Profile | Strongly recommended |
| `TWILIO_ACCOUNT_SID` | Twilio Console | If `twilio` |
| `TWILIO_AUTH_TOKEN` | Twilio Console | If `twilio` |
| `PAYSTACK_SECRET_KEY` | Paystack dashboard | When live payments |
| `PAYSTACK_PUBLIC_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack | When live payments |

## Supabase Auth setup

1. Enable **Email** provider.
2. Enable **Google** OAuth if you use “Continue with Google”.
3. Add redirect URLs:
   - `https://your-app-url`
   - `https://your-app-url/**`
4. Run migrations: `supabase db push` (or `db reset` in non-prod).

## Provider setup

### Telnyx
1. Create Messaging Profile → inbound webhook = `SMS_WEBHOOK_URL`.
2. Forward a shared secret as `x-webhook-secret` (proxy or custom header if supported).
3. Complete US A2P registration before production SMS.

### Twilio
1. Upgrade from trial to buy numbers.
2. Provision sets `SmsUrl` automatically from `SMS_WEBHOOK_URL`.
3. Optionally put a thin proxy in front to inject `x-webhook-secret`.

## Billing

Today:
- `POST /billing/initiate/:rentalId` creates a pending payment + checkout URL.
- Only `POST /billing/webhook` with `x-billing-secret` can mark paid + provision.

Until Paystack is fully wired, the `/pay/:reference` page is a **dev simulator** that shows the reference and instructions for calling the billing webhook.

## Health

`GET /health` → `{ status, service, provider, time }`

## Do not ship without

- [ ] All **Yes** env vars set
- [ ] Secrets ≠ `change-me-in-production`
- [ ] `NODE_ENV=production`
- [ ] CORS origin = real app URL (not `*`)
- [ ] Migrations applied
- [ ] Webhook URLs reachable over HTTPS
- [ ] Provider credentials valid
