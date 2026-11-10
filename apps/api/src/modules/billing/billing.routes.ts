import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { requireUserId, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
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

function verifyPaystackSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
  if (!PAYSTACK_SECRET_KEY || !rawBody || !signature || !/^[a-f0-9]{128}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

async function paystackRequest<T>(path: string, init: RequestInit): Promise<T> {
  if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not configured");

  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = (await response.json()) as PaystackEnvelope<T>;
  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message ?? "Paystack request failed");
  }
  return payload.data;
}

export async function billingRoutes(app: FastifyInstance) {
  const rentals = new RentalsService(getProvider("mock"));
  const accounts = new AccountsService();

  app.post("/billing/initiate/:rentalId", async (request, reply) => {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        return reply.code(503).send({ error: "Payments are not configured" });
      }

      const userId = await requireUserId(request);
      const { rentalId } = request.params as { rentalId: string };
      const rental = await rentals.getById(rentalId);

      if (!rental) return reply.code(404).send({ error: "Rental not found" });
      if (rental.status !== "pending_payment") {
        return reply.code(422).send({ error: "Rental is not awaiting payment" });
      }

      const allowed = await accounts.userBelongsToAccount(userId, rental.account_id);
      if (!allowed) return reply.code(403).send({ error: "Forbidden" });

      const supabase = getSupabase();
      const [{ data: number, error: numberError }, { data: authUser, error: userError }] =
        await Promise.all([
          supabase.from("numbers").select("monthly_cost_cents").eq("id", rental.number_id).single(),
          supabase.auth.admin.getUserById(userId),
        ]);

      if (numberError || !number) {
        return reply.code(404).send({ error: "Number pricing not found" });
      }
      if (userError || !authUser.user?.email) {
        return reply.code(422).send({ error: "A verified account email is required for payment" });
      }
      if (!Number.isSafeInteger(number.monthly_cost_cents) || number.monthly_cost_cents <= 0) {
        return reply.code(422).send({ error: "Invalid rental amount" });
      }

      const reference = `pts_${randomUUID().replace(/-/g, "")}`;
      const amountCents = number.monthly_cost_cents;

      const { error: paymentError } = await supabase.from("payments").insert({
        rental_id: rentalId,
        provider: "paystack",
        provider_reference: reference,
        amount_cents: amountCents,
        currency: PAYSTACK_CURRENCY,
        status: "pending",
      });

      if (paymentError) {
        request.log.error({ err: paymentError }, "Failed to create pending payment");
        return reply.code(500).send({ error: "Failed to create payment" });
      }

      try {
        const checkout = await paystackRequest<{
          authorization_url: string;
          access_code: string;
          reference: string;
        }>("/transaction/initialize", {
          method: "POST",
          body: JSON.stringify({
            email: authUser.user.email,
            amount: String(amountCents),
            currency: PAYSTACK_CURRENCY,
            reference,
            callback_url: `${APP_URL}/payment/callback`,
            metadata: { rentalId },
          }),
        });

        if (checkout.reference !== reference || !checkout.authorization_url) {
          throw new Error("Paystack returned an invalid checkout response");
        }

        return {
          payment: {
            reference,
            amountCents,
            currency: PAYSTACK_CURRENCY,
            checkoutUrl: checkout.authorization_url,
          },
        };
      } catch (err) {
        await supabase
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("provider_reference", reference)
          .eq("status", "pending");

        throw err;
      }
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Initiate Paystack payment failed");
      return reply.code(502).send({
        error: err instanceof Error ? err.message : "Failed to initialize payment",
      });
    }
  });

  app.post("/billing/webhook", async (request, reply) => {
    if (!PAYSTACK_SECRET_KEY) {
      return reply.code(503).send({ error: "Paystack webhook is not configured" });
    }

    const signature = request.headers["x-paystack-signature"];
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;
    if (!verifyPaystackSignature(rawBody, typeof signature === "string" ? signature : undefined)) {
      return reply.code(401).send({ error: "Invalid Paystack signature" });
    }

    const event = request.body as {
      event?: string;
      data?: { reference?: string };
    };

    // Paystack sends other event types too; acknowledge those without processing them.
    if (event?.event !== "charge.success") return { ok: true, ignored: true };

    const reference = event.data?.reference;
    if (!reference) return reply.code(400).send({ error: "Missing transaction reference" });

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
    if (!payment) return reply.code(404).send({ error: "Unknown payment reference" });

    try {
      const verified = await paystackRequest<PaystackTransaction>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        { method: "GET" }
      );

      if (
        verified.status !== "success" ||
        verified.reference !== reference ||
        verified.amount !== payment.amount_cents ||
        verified.currency.toUpperCase() !== payment.currency.toUpperCase() ||
        verified.metadata?.rentalId !== payment.rental_id
      ) {
        request.log.warn({ reference }, "Paystack transaction did not match pending payment");
        return reply.code(422).send({ error: "Payment verification did not match the order" });
      }

      if (payment.status !== "succeeded") {
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: "succeeded",
            verified_at: new Date().toISOString(),
            raw_payload: event,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("status", "pending");

        if (updateError) {
          request.log.error({ err: updateError }, "Failed to mark payment successful");
          return reply.code(500).send({ error: "Failed to record verified payment" });
        }
      }

      const rental = await rentals.getById(payment.rental_id);
      if (!rental) return reply.code(404).send({ error: "Rental not found" });

      // A duplicate webhook may safely resume only the not-yet-claimed transition.
      if (rental.status === "pending_payment") {
        try {
          const result = await rentals.confirmPaymentAndProvision(payment.rental_id, WEBHOOK_URL);
          return { ok: true, rental: result.rental };
        } catch (err) {
          request.log.error({ err, reference }, "Provisioning after verified payment failed");
          return reply.code(202).send({
            ok: true,
            paymentRecorded: true,
            provisioning: "requires_reconciliation",
          });
        }
      }

      return { ok: true, paymentRecorded: true, rentalStatus: rental.status };
    } catch (err) {
      request.log.error({ err, reference }, "Paystack verification failed");
      return reply.code(502).send({ error: "Could not verify transaction with Paystack" });
    }
  });
}
