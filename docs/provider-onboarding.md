# Provider Onboarding

## Current adapters

| Name | Status | Notes |
|------|--------|--------|
| `mock` | Ready | Local inventory, no carrier calls |
| `telnyx` | Ready | Search / order / release via Telnyx v2 API |
| `twilio` | Ready | Search / buy / release via Twilio 2010 API |

## Switching providers

```bash
TELECOM_PROVIDER=twilio   # or mock | telnyx
```

`getProvider()` reads this env (default `mock`). All routes use `getProvider()` — no hard-coded mock.

## Telnyx checklist

1. API key + Messaging Profile.
2. Profile inbound webhook → `https://<api>/api/v1/webhooks/sms`.
3. Env: `TELNYX_API_KEY`, `TELNYX_MESSAGING_PROFILE_ID`.
4. A2P / compliance before production US SMS.

## Twilio checklist

1. Account SID + Auth Token.
2. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
3. Provision sets `SmsUrl` to `SMS_WEBHOOK_URL` automatically.
4. Upgrade trial account before buying numbers.

## Rental cancel / release

| Status | Action | Effect |
|--------|--------|--------|
| `pending_payment` | Cancel | Inventory free (no carrier call) |
| `active` / `provisioning` | Release | Provider delete + inventory free |

Endpoint: `POST /api/v1/rentals/:id/cancel`
