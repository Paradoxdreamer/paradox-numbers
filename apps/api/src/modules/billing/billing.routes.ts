import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { requireUserId, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;\nconst PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const PAYSTACK_CURRENCY = (process.env.PAYSTACK_CURRENCY ?? "USD").toUpperCase();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const PAYSTACK_API = "https://api.paystack.co";

type PaystackEnvelope<T> = {
  status: boolean;
  message?: string;
  data?: T;
};

type PaystackTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: { rentalId?: string; [key: string]: unknown };
};

function safeHexMatch(expected: Buffer, signature: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

function verifyPaystackSignature(
  rawBody: Buffer | undefined,
  legacySignature: string | undefined,
  modernSignature: string | undefined
): boolean {
  if (!rawBody) return false;

  // Current Paystack webhook signing-secret format.
  if (modernSignature) {
    if (!PAYSTACK_WEBHOOK_SECRET) return false;
    const fields = modernSignature.split(",");
    const timestampField = fields.find((field) => field.trim().startsWith("t="));
    const timestamp = Number(timestampField?.trim().slice(2));
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return false;
    }

    const expected = createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)
      .update(String(timestamp))
      .update(".")
      .update(rawBody)
      .digest();

    return fields.some((field) => {
      const value = field.trim();
      if (!value.startsWith("v1=")) return false;
      const signaturePart = value.slice(3);
      const separator = signaturePart.indexOf(":");
      if (separator < 1) return false;
      return safeHexMatch(expected, signaturePart.slice(separator + 1));
    });
  }

  // Legacy x-paystack-signature: HMAC SHA512 of the exact raw body.
  if (!PAYSTACK_SECRET_KEY || !legacySignature) return false;
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest();
  return safeHexMatch(expected, legacySignature);
}
