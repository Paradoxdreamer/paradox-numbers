import type { FastifyInstance } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { requireUserId, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";

const BILLING_WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET;

export async function billingRoutes(app: FastifyInstance) {
  const rentals = new RentalsService(getProvider());
  const accounts = new AccountsService();

  app.post("/billing/initiate/:rentalId", async (request, reply) => {
    try {
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

      const { data: number } = await supabase
        .from("numbers")
        .select("monthly_cost_cents, phone_number")
        .eq("id", rental.number_id)
        .single();

      if (!number) return reply.code(500).send({ error: "Number missing" });

      const reference = `pts_${rentalId.slice(0, 8)}_${Date.now()}`;

      const { error: paymentError } = await supabase.from("payments").insert({
        rental_id: rentalId,
        provider: "paystack",
        provider_reference: reference,
        amount_cents: number.monthly_cost_cents,
        currency: "USD",
        status: "pending",
      });

      if (paymentError) {
        request.log.error({ err: paymentError }, "Failed to create payment");
        return reply.code(500).send({ error: "Failed to create payment" });
      }

      const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pay/${reference}`;

      return {
        payment: {
          reference,
          amountCents: number.monthly_cost_cents,
          checkoutUrl,
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

    const { error: upsertError } = await supabase.from("payments").upsert(
      {
        rental_id: body.rentalId,
        provider: "paystack",
        provider_reference: body.providerReference,
        amount_cents: body.amountCents,
        currency: body.currency ?? "USD",
        status: "succeeded",
        raw_payload: body,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "provider_reference" }
    );

    if (upsertError) {
      request.log.error({ err: upsertError }, "Failed to record payment");
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
