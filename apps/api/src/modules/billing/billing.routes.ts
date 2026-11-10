import type { FastifyInstance } from "fastify";
import { RentalsService } from "../rentals/rentals.service";
import { getProvider } from "../telecom";
import { requireUserId, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ?? "http://localhost:3001/api/v1/webhooks/sms";

export async function billingRoutes(app: FastifyInstance) {
  const rentals = new RentalsService(getProvider("mock"));
  const accounts = new AccountsService();

  /**
   * Mock payment confirmation.
   * In production this is called by the payment provider webhook
   * after the charge succeeds — never by the frontend declaring success.
   *
   * For now it can be hit by an authenticated user for demo purposes,
   * but the status transition still happens only on the backend.
   */
  app.post("/billing/confirm/:rentalId", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { rentalId } = request.params as { rentalId: string };

      const rental = await rentals.getById(rentalId);
      if (!rental) {
        return reply.code(404).send({ error: "Rental not found" });
      }

      const allowed = await accounts.userBelongsToAccount(userId, rental.account_id);
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const result = await rentals.confirmPaymentAndProvision(rentalId, WEBHOOK_URL);

      return { rental: result.rental, provision: result.provision };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      const message = err instanceof Error ? err.message : "Payment confirmation failed";
      request.log.error({ err }, "Confirm payment failed");
      return reply.code(422).send({ error: message });
    }
  });
}
