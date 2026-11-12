# Provider Onboarding

## Current adapters

| Name | Status | Notes |
|------|--------|--------|
| `mock` | Ready | Local inventory, no carrier calls |
| `telnyx` | Ready | Search / order / release via Telnyx v2 API |
| `twilio` | Not implemented | Stub throws |

## Switching providers

```bash
TELECOM_PROVIDER=telnyx   # or mock | twilio
```

`getProvider()` reads this env (default `mock`).

## Telnyx checklist

1. Create a Telnyx account and API key.
2. Create a **Messaging Profile** and set its inbound webhook to:
   `https://<your-api-host>/api/v1/webhooks/sms`
   (and pass `x-webhook-secret` via a proxy or Telnyx custom header if available).
3. Set env:
   ```
   TELECOM_PROVIDER=telnyx
   TELNYX_API_KEY=...
   TELNYX_MESSAGING_PROFILE_ID=...
   ```
4. Confirm **reseller / compliance** posture (A2P 10DLC for US SMS) before production traffic.
5. Search is free/read-only. Orders charge your Telnyx balance.

## Interface contract

All adapters implement `TelecomProvider` in
`apps/api/src/modules/telecom/provider.interface.ts`.

Optional: implement `WebhookVerifier` for signature verification + payload parsing
(see `TelnyxWebhookVerifier`).
