import type { FastifyInstance } from "fastify";
import { NumbersService } from "./numbers.service";
import { getProvider } from "../telecom";

export async function numbersRoutes(app: FastifyInstance) {
  const service = new NumbersService(getProvider("mock"));

  app.get("/numbers/search", async (request) => {
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
  });
}