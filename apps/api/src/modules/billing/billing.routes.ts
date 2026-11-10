import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { requireAuthenticatedUser, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
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

type PaystackWebhookEvent = {
  event?: string;
  data?: { reference?: string };
};

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

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

  // Current signing-secret format: timestamp + "." + exact raw body.
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

  // Legacy x-paystack-signature format, signed with the Paystack secret key.
  if (!PAYSTACK_SECRET_KEY || !legacySignature) return false;
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest();
  return safeHexMatch(expected, legacySignature);
}

async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not configured");

  const response = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
  const payload = (await response.json()) as PaystackEnvelope<PaystackTransaction>;

  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message ?? "Paystack transaction verification failed");
  }
  return payload.data;
}

export async function billingRoutes(app: FastifyInstance) {
  const rentals = new RentalsService(getProvider("mock"));
  const accounts = new AccountsService();

  app.post("/billing/initiate/:rentalId", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request);
      if (!PAYSTACK_SECRET_KEY) {
        return reply.code(503).send({ error: "Payments are not configured" });
      }

      const { rentalId } = request.params as { rentalId: string };
      const rental = await rentals.getById(rentalId);
      if (!rental) return reply.code(404).send({ error: "Rental not found" });
      if (rental.status !== "pending_payment") {
        return reply.code(422).send({ error: "Rental is not awaiting payment" });
      }

      const allowed = await accounts.userBelongsToAccount(user.id, rental.account_id);
      if (!allowed) return reply.code(403).send({ error: "Forbidden" });
      if (!user.email) {
        return reply.code(422).send({ error: "Your account needs a verified email address" });
      }

      const supabase = getSupabase();
      const { data: number, error: numberError } = await supabase
        .from("numbers")
        .select("monthly_cost_cents, phone_number")
        .eq("id", rental.number_id)
        .single();

      if (numberError || !number || !Number.isSafeInteger(number.monthly_cost_cents) ||
          number.monthly_cost_cents <= 0) {
        request.log.error({ err: numberError }, "Unable to determine rental price");
        return reply.code(422).send({ error: "Rental price is unavailable" });
      }

      const reference = `pts_${rentalId.slice(0, 8)}_${randomUUID().replace(/-/g, "")}`;
      const { error: paymentError } = await supabase.from("payments").insert({
        rental_id: rentalId,
        provider: "paystack",
        provider_reference: reference,
        amount_cents: number.monthly_cost_cents,
        currency: PAYSTACK_CURRENCY,
        status: "pending",
      });

      if (paymentError) {
        request.log.error({ err: paymentError }, "Failed to create pending payment");
        return reply.code(500).send({ error: "Failed to create payment" });
      }

      const initializeResponse = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: number.monthly_cost_cents,
          currency: PAYSTACK_CURRENCY,
          reference,
          callback_url: APP_URL,
          metadata: { rentalId, accountId: rental.account_id },
        }),
      });

      const initialized = (await initializeResponse.json()) as PaystackEnvelope<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>;

      if (!initializeResponse.ok || !initialized.status || !initialized.data?.authorization_url ||
          initialized.data.reference !== reference) {
        await supabase.from("payments").update({ status: "failed" })
          .eq("provider_reference", reference).eq("status", "pending");
        request.log.error({ message: initialized.message }, "Paystack initialization failed");
        return reply.code(502).send({ error: "Payment provider could not initialize checkout" });
      }

      return {
        payment: {
          reference,
          amountCents: number.monthly_cost_cents,
          currency: PAYSTACK_CURRENCY,
          checkoutUrl: initialized.data.authorization_url,
        },
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Initiate payment failed");
      return reply.code(500).send({ error: "Failed to initiate payment" });
    }
  });

  app.post("/billing/webhook", async (request, reply) => {
    const rawBody = (request as RawBodyRequest).rawBody;
    const legacySignature = request.headers["x-paystack-signature"];
    const modernSignature = request.headers["paystack-signature"];
    const legacy = Array.isArray(legacySignature) ? legacySignature[0] : legacySignature;
    const modern = Array.isArray(modernSignature) ? modernSignature[0] : modernSignature;

    if (!verifyPaystackSignature(rawBody, legacy, modern)) {
      return reply.code(401).send({ error: "Invalid Paystack signature" });
    }

    const event = request.body as PaystackWebhookEvent;
    if (event.event === "ping") return reply.code(200).send({ ok: true });
    if (event.event !== "charge.success" || !event.data?.reference) {
      return reply.code(200).send({ ok: true, ignored: true });
    }

    const reference = event.data.reference;
    const supabase = getSupabase();
    const { data: payment, error: paymentLookupError } = await supabase
      .from("payments")
      .select("*")
      .eq("provider", "paystack")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (paymentLookupError) {
      request.log.error({ err: paymentLookupError }, "Payment lookup failed");
      return reply.code(500).send({ error: "Payment lookup failed" });
    }
    if (!payment) {
      request.log.warn({ reference }, "Verified Paystack event has no local payment");
      return reply.code(200).send({ ok: true, ignored: true });
    }

    let transaction: PaystackTransaction;
    try {
      transaction = await verifyTransaction(reference);
    } catch (err) {
      request.log.error({ err, reference }, "Paystack transaction verification failed");
      return reply.code(502).send({ error: "Unable to verify transaction with Paystack" });
    }

    if (
      transaction.status !== "success" ||
      transaction.reference !== reference ||
      transaction.amount !== payment.amount_cents ||
      transaction.currency?.toUpperCase() !== payment.currency?.toUpperCase() ||
      (transaction.metadata?.rentalId && transaction.metadata.rentalId !== payment.rental_id)
    ) {
      request.log.error({
        reference,
        transactionStatus: transaction.status,
        transactionAmount: transaction.amount,
        expectedAmount: payment.amount_cents,
        transactionCurrency: transaction.currency,
        expectedCurrency: payment.currency,
      }, "Paystack transaction did not match the pending payment");
      return reply.code(400).send({ error: "Payment details do not match" });
    }

    if (payment.status !== "pending" && payment.status !== "succeeded") {
      request.log.warn({ reference, status: payment.status }, "Ignoring successful event for a non-pending payment");
      return reply.code(409).send({ error: "Payment is not pending" });
    }

    if (payment.status !== "succeeded") {
      const { error: updateError } = await supabase.from("payments").update({
        status: "succeeded",
        verified_at: new Date().toISOString(),
      }).eq("id", payment.id).eq("status", "pending");

      if (updateError) {
        request.log.error({ err: updateError, reference }, "Failed to mark payment successful");
        return reply.code(500).send({ error: "Failed to record verified payment" });
      }
    }

    const rental = await rentals.getById(payment.rental_id);
    if (!rental) {
      request.log.error({ reference, rentalId: payment.rental_id }, "Paid rental not found");
      return reply.code(500).send({ error: "Paid rental not found" });
    }
    if (rental.status === "active") return { ok: true, alreadyProcessed: true };

    if (rental.status !== "pending_payment") {
      // A previous attempt may have reached the provider before failing to persist its result.
      // Do not blindly provision again: the telecom adapter must support idempotency first.
      request.log.warn({ reference, rentalId: rental.id, status: rental.status },
        "Payment is verified; rental requires provisioning reconciliation");
      return reply.code(202).send({ ok: true, paymentRecorded: true, reconciliationRequired: true });
    }

    try {
      const result = await rentals.confirmPaymentAndProvision(payment.rental_id, WEBHOOK_URL);
      return { ok: true, rental: result.rental };
    } catch (err) {
      request.log.error({ err, reference }, "Provisioning after verified payment failed");
      return reply.code(500).send({ error: "Payment verified; provisioning requires reconciliation" });
    }
  });
}
