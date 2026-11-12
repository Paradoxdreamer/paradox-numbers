import type { FastifyInstance } from "fastify";
import { NumbersService } from "./numbers.service";
import { getProvider } from "../telecom";
import { requireUserId, AuthError } from "../../lib/auth";

export async function numbersRoutes(app: FastifyInstance) {
  const service = new NumbersService(getProvider());

  app.get("/numbers/search", async (request, reply) => {
    try {
      await requireUserId(request);

      const query = request.query as {
        country?: string;
        areaCode?: string;
        capabilities?: string;
        limit?: string;
      };

      const capabilities = query.capabilities
        ? (query.capabilities.split(",") as ("sms" | "voice" | "mms")[])
        : undefined;

      const results = await service.search({
        countryCode: query.country ?? "US",
        areaCode: query.areaCode,
        capabilities,
        limit: query.limit ? Number(query.limit) : 20,
      });

      return { numbers: results };
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message });
      }
      request.log.error({ err }, "Number search failed");
      return reply.code(500).send({ error: "Search failed" });
    }
  });
}
