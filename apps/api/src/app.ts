import Fastify from "fastify";
import { numbersRoutes } from "./modules/numbers/numbers.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { messagesRoutes } from "./modules/messages/messages.routes";
import { accountsRoutes } from "./modules/accounts/accounts.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Basic CORS so the Next.js app can talk to the API in local dev
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", process.env.NEXT_PUBLIC_APP_URL ?? "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.get("/health", async () => {
    return { status: "ok", service: "paradox-numbers-api" };
  });

  await app.register(accountsRoutes, { prefix: "/api/v1" });
  await app.register(numbersRoutes, { prefix: "/api/v1" });
  await app.register(rentalsRoutes, { prefix: "/api/v1" });
  await app.register(messagesRoutes, { prefix: "/api/v1" });

  return app;
}
