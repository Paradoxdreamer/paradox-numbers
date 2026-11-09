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
      periodDays?: number;
    };

    if (!body.phoneNumber || !body.accountId) {
      return reply.code(400).send({
        error: "accountId and phoneNumber are required",
      });
    }

    try {
      const result = await service.create({
        accountId: body.accountId,
        phoneNumber: body.phoneNumber,
        webhookUrl:
          body.webhookUrl ??
          `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/webhooks/sms`,
        periodDays: body.periodDays,
      });

      return reply.code(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create rental";
      request.log.error({ err }, "Create rental failed");
      return reply.code(422).send({ error: message });
    }
  });

  app.get("/accounts/:accountId/rentals", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };

    try {
      const rentals = await service.listByAccount(accountId);
      return { rentals };
    } catch (err) {
      request.log.error({ err }, "List rentals failed");
      return reply.code(500).send({ error: "Failed to list rentals" });
    }
  });

  app.get("/rentals/:rentalId", async (request, reply) => {
    const { rentalId } = request.params as { rentalId: string };

    try {
      const rental = await service.getById(rentalId);
      if (!rental) {
        return reply.code(404).send({ error: "Rental not found" });
      }
      return { rental };
    } catch (err) {
      request.log.error({ err }, "Get rental failed");
      return reply.code(500).send({ error: "Failed to get rental" });
    }
  });
}
