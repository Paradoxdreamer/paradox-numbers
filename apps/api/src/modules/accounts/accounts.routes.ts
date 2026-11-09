import type { FastifyInstance } from "fastify";
import { AccountsService } from "./accounts.service";
import { requireUserId, AuthError } from "../../lib/auth";

export async function accountsRoutes(app: FastifyInstance) {
  const service = new AccountsService();

  app.post("/accounts", async (_request, reply) => {
    return reply.code(410).send({
      error: "Use POST /accounts/me instead. userId is taken from the JWT.",
    });
  });

  app.post("/accounts/me", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const body = request.body as { name?: string } | null;

      const account = await service.getOrCreateForUser(
        userId,
        body?.name ?? "Personal"
      );

      return { account };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Get-or-create account failed");
      return reply.code(500).send({ error: "Failed to resolve account" });
    }
  });

  app.get("/accounts/:accountId", async (request, reply) => {
    try {
      const userId = await requireUserId(request);
      const { accountId } = request.params as { accountId: string };

      const allowed = await service.userBelongsToAccount(userId, accountId);
      if (!allowed) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const account = await service.getById(accountId);
      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }
      return { account };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Get account failed");
      return reply.code(500).send({ error: "Failed to get account" });
    }
  });
}