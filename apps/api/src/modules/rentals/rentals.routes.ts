import type { FastifyInstance } from "fastify";
import { RentalsService } from "./rentals.service";
import { getProvider } from "../telecom";
import { requireUserId, AuthError } from "../../lib/auth";
import { AccountsService } from "../accounts/accounts.service";

const WEBHOOK_URL =
  process.env.SMS_WEBHOOK_URL ??
  "http://localhost:3001/api/v1/webhooks/sms";

export async function rentalsRoutes(app: FastifyInstance) {
  const service = new RentalsService(getProvider("mock"));
  const accounts = new AccountsService();

  app.post("/rentals", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const body = request.body as {
        phoneNumber?: string;
        periodDays?: number;
      };

      if (!body.phoneNumber) {
        return reply.code(400).send({ error: "phoneNumber is required" });
      }

      const account = await accounts.getOrCreateForUser(userId);

      const result = await service.create({
        accountId: account.id,
        phoneNumber: body.phoneNumber,
        webhookUrl: WEBHOOK_URL,
        periodDays: body.periodDays,
      });

      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      const message =
        err instanceof Error ? err.message : "Failed to create rental";
      request.log.error({ err }, "Create rental failed");
      return reply.code(422).send({ error: message });
    }
  });

  app.get("/accounts/:accountId/rentals", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { accountId } = request.params as { accountId: string };

      const allowed = await accounts.userBelongsToAccount(userId, accountId);
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const rentals = await service.listByAccount(accountId);
      return { rentals };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "List rentals failed");
      return reply.code(500).send({ error: "Failed to list rentals" });
    }
  });

  app.get("/rentals/:rentalId", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { rentalId } = request.params as { rentalId: string };

      const rental = await service.getById(rentalId);
      if (!rental) {
        return reply.code(404).send({ error: "Rental not found" });
      }

      const allowed = await accounts.userBelongsToAccount(
        userId,
        rental.account_id
      );
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      return { rental };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Get rental failed");
      return reply.code(500).send({ error: "Failed to get rental" });
    }
  });

  /**
   * Cancel a pending_payment rental and free the number.
   */
  app.post("/rentals/:rentalId/cancel", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { rentalId } = request.params as { rentalId: string };

      const rental = await service.getById(rentalId);
      if (!rental) {
        return reply.code(404).send({ error: "Rental not found" });
      }

      const allowed = await accounts.userBelongsToAccount(
        userId,
        rental.account_id
      );
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const cancelled = await service.cancelPending(rentalId);
      return { rental: cancelled };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      const message =
        err instanceof Error ? err.message : "Failed to cancel rental";
      request.log.error({ err }, "Cancel rental failed");
      return reply.code(422).send({ error: message });
    }
  });
}
