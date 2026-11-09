import type { FastifyInstance } from "fastify";
import { RentalsService } from "./rentals.service";
import { getProvider } from "../telecom";

export async function rentalsRoutes(app: FastifyInstance) {
  const service = new RentalsService(getProvider("mock"));

  app.post("/rentals", async (request, reply) => {
    const body = request.body as {
      accountId?: string;
      phoneNumber?: string;
      webhookUrl?: string;
    };

    if (!body.phoneNumber || !body.accountId) {
      return reply.code(400).send({ error: "accountId and phoneNumber required" });
    }

    const result = await service.create({
      accountId: body.accountId,
      phoneNumber: body.phoneNumber,
      webhookUrl: body.webhookUrl ?? "https://example.com/webhooks/sms",
    });

    return reply.code(201).send(result);
  });
}