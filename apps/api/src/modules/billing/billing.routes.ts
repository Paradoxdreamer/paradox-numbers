import type { FastifyInstance } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";

const BILLING_WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET;

export async function billingRoutes(app: FastifyInstance) {
  const rentals = new RentalsService(getProvider("mock"));

  /**
   * Payment provider webhook.
   * Only this route (or an internal job) can move a rental out of pending_payment.
   * The frontend cannot call this.
   *
   * Expects header: x-billing-secret
   * Body: { rentalId, providerReference, amountCents, currency? }
   */
  app.post("/billing/webhook", async (request, reply) => {
    if (!BILLING_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "Billing webhook not configured" });
    }

    const secret = request.headers["x-billing-secret"];
    if (secret !== BILLING_WEBHOOK_SECRET) {
      return reply.code(401).send({ error: "Invalid billing secret" });
    }

    const body = request.body as {
      rentalId?: string;
      providerReference?: string;
      amountCents?: number;
      currency?: string;
    };

    if (!body.rentalId || !body.providerReference || body.amountCents == null) {
      return reply.code(400).send({
        error: "rentalId, providerReference and amountCents are required",
      });
    }

    const supabase = getSupabase();

    const { error: paymentError } = await supabase.from("payments").insert({
      rental_id: body.rentalId,
      provider: "paystack",
      provider_reference: body.providerReference,
      amount_cents: body.amountCents,
      currency: body.currency ?? "USD",
      status: "succeeded",
      verified_at: new Date().toISOString(),
      raw_payload: body,
    });

    if (paymentError) {
      if (paymentError.code === "23505") {
        return { ok: true, alreadyProcessed: true };
      }
      request.log.error({ err: paymentError }, "Failed to record payment");
      return reply.code(500).send({ error: "Failed to record payment" });
    }

    try {
      const result = await rentals.confirmPaymentAndProvision(
        body.rentalId,
        WEBHOOK_URL
      );
      return { ok: true, rental: result.rental };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Provisioning failed";
      request.log.error({ err }, "Provisioning after payment failed");
      return reply.code(202).send({
        ok: true,
        paymentRecorded: true,
        provisioningError: message,
      });
    }
  });
}
