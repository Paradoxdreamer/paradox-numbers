import type { FastifyInstance } from "fastify";
import { MessagesService } from "./messages.service";
import type { IncomingMessage } from "../telecom";

/**
 * Webhook routes.
 *
 * For now we accept a simple JSON payload that matches IncomingMessage.
 * Real providers (Telnyx / Twilio) will later plug in signature verification
 * via the WebhookVerifier interface.
 */
export async function messagesRoutes(app: FastifyInstance) {
  const service = new MessagesService();

  app.post("/webhooks/sms", async (request, reply) => {
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

  // Convenience: list messages for a rental (useful for dashboard later)
  app.get("/rentals/:rentalId/messages", async (request, reply) => {
    const { rentalId } = request.params as { rentalId: string };
    const query = request.query as { limit?: string };

    try {
      const messages = await service.listByRental(
        rentalId,
        query.limit ? Number(query.limit) : 50
      );
      return { messages };
    } catch (err) {
      request.log.error({ err }, "Failed to list messages");
      return reply.code(500).send({ error: "Failed to list messages" });
    }
  });
}
