import type { FastifyInstance } from "fastify";
import { AccountsService } from "./accounts.service";
import { requireUserId, AuthError } from "../../lib/auth";

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

  /**
   * Resolve (or create) the account for the authenticated user.
   * Requires a valid Supabase JWT in the Authorization header.
   * userId is taken from the token — never from the body.
   */
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
