/**
 * Environment contract for Paradox Numbers API.
 * Call assertEnv() once at boot before listen().
 */

export type TelecomProviderName = "mock" | "telnyx" | "twilio";

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function assertEnv(): void {
  const isProd = process.env.NODE_ENV === "production";

  // Always required for the API to talk to the DB / Auth
  required("SUPABASE_URL");
  required("SUPABASE_SERVICE_ROLE_KEY");
  // Anon key needed for JWT verification via getUser(token)
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (isProd) {
    required("SMS_WEBHOOK_SECRET");
    required("BILLING_WEBHOOK_SECRET");
    required("NEXT_PUBLIC_APP_URL");

    const smsSecret = process.env.SMS_WEBHOOK_SECRET!;
    if (smsSecret === "change-me-in-production" || smsSecret.length < 16) {
      throw new Error("SMS_WEBHOOK_SECRET must be a strong secret in production");
    }
    const billSecret = process.env.BILLING_WEBHOOK_SECRET!;
    if (billSecret === "change-me-in-production" || billSecret.length < 16) {
      throw new Error("BILLING_WEBHOOK_SECRET must be a strong secret in production");
    }
  }

  const provider = (process.env.TELECOM_PROVIDER ?? "mock").toLowerCase();
  if (!["mock", "telnyx", "twilio"].includes(provider)) {
    throw new Error(`Invalid TELECOM_PROVIDER: ${provider}`);
  }

  if (provider === "telnyx") {
    required("TELNYX_API_KEY");
  }
  if (provider === "twilio") {
    required("TWILIO_ACCOUNT_SID");
    required("TWILIO_AUTH_TOKEN");
  }

  // Soft warnings (non-fatal)
  if (!process.env.SMS_WEBHOOK_URL) {
    console.warn("[env] SMS_WEBHOOK_URL not set — using default localhost webhook");
  }
  if (provider === "telnyx" && !process.env.TELNYX_MESSAGING_PROFILE_ID) {
    console.warn(
      "[env] TELNYX_MESSAGING_PROFILE_ID not set — ordered numbers may not receive SMS"
    );
  }
}

export function getTelecomProviderName(): TelecomProviderName {
  return (process.env.TELECOM_PROVIDER ?? "mock").toLowerCase() as TelecomProviderName;
}

export function envSummary(): Record<string, string> {
  return {
    NODE_ENV: optional("NODE_ENV", "development"),
    TELECOM_PROVIDER: getTelecomProviderName(),
    API_PORT: optional("API_PORT", "3001"),
    APP_URL: optional("NEXT_PUBLIC_APP_URL", "(unset)"),
    SMS_WEBHOOK_CONFIGURED: process.env.SMS_WEBHOOK_SECRET ? "yes" : "no",
    BILLING_WEBHOOK_CONFIGURED: process.env.BILLING_WEBHOOK_SECRET ? "yes" : "no",
  };
}
