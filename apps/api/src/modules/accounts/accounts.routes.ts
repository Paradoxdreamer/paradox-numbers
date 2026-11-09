import type { FastifyInstance } from "fastify";
import { AccountsService } from "./accounts.service";

export async function accountsRoutes(app: FastifyInstance) {
  const service = new AccountsService();

  app.post("/accounts", async (request, reply) => {
    const body = request.body as {
      name?: string;
      type?: "personal" | "business";
      userId?: string;
    };

    if (!body.name || body.name.trim().length < 2) {
      return reply.code(400).send({ error: "name is required (min 2 chars)" });
    }

    try {
      const account = await service.create({
        name: body.name,
        type: body.type,
        userId: body.userId,
      });
      return reply.code(201).send({ account });
    } catch (err) {
      request.log.error({ err }, "Create account failed");
      return reply.code(500).send({ error: "Failed to create account" });
    }
  });

  app.get("/accounts/:accountId", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };

    try {
      const account = await service.getById(accountId);
      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }
      return { account };
    } catch (err) {
      request.log.error({ err }, "Get account failed");
      return reply.code(500).send({ error: "Failed to get account" });
    }
  });
}
