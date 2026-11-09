import type { FastifyInstance } from "fastify";
import { MessagesService } from "./messages.service";
import type { IncomingMessage } from "../telecom";
import { requireUserId, AuthError } from "../../lib/auth";
import { RentalsService } from "../rentals/rentals.service";
import { AccountsService } from "../accounts/accounts.service";
import { getProvider } from "../telecom";

const WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET ?? "dev-webhook-secret-change-me";

export async function messagesRoutes(app: FastifyInstance) {
  const service = new MessagesService();
  const rentals = new RentalsService(getProvider("mock"));
  const accounts = new AccountsService();

  app.post("/webhooks/sms", async (request, reply) => {
    const secret = request.headers["x-webhook-secret"];
    if (secret !== WEBHOOK_SECRET) {
      return reply.code(401).send({ error: "Invalid webhook secret" });
    }

    const body = request.body as Partial<IncomingMessage> & { raw?: unknown };

    if (!body.from || !body.to || !body.body) {
      return reply.code(400).send({
        error: "from, to and body are required",
      });
    }

    const incoming: IncomingMessage = {
      from: body.from,
      to: body.to,
      body: body.body,
      providerMessageId: body.providerMessageId ?? `manual_${Date.now()}`,
      receivedAt: body.receivedAt ?? new Date().toISOString(),
      raw: body.raw ?? body,
    };

    try {
      const message = await service.storeIncoming(incoming);
      return reply.code(201).send({ message });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      request.log.error({ err }, "Failed to store incoming SMS");
      return reply.code(422).send({ error: message });
    }
  });

  app.get("/rentals/:rentalId/messages", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { rentalId } = request.params as { rentalId: string };
      const query = request.query as { limit?: string };

      const rental = await rentals.getById(rentalId);
      if (!rental) {
        return reply.code(404).send({ error: "Rental not found" });
      }

      const allowed = await accounts.userBelongsToAccount(userId, rental.account_id);
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const messages = await service.listByRental(
        rentalId,
        query.limit ? Number(query.limit) : 50
      );
      return { messages };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Failed to list messages");
      return reply.code(500).send({ error: "Failed to list messages" });
    }
  });
}