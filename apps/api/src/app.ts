import Fastify from "fastify";
import { numbersRoutes } from "./modules/numbers/numbers.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";
import { messagesRoutes } from "./modules/messages/messages.routes";
import { accountsRoutes } from "./modules/accounts/accounts.routes";
import { billingRoutes } from "./modules/billing/billing.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "*";

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", appOrigin);
    reply.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Webhook-Secret, X-Billing-Secret"
    );
    reply.header("Access-Control-Max-Age", "86400");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "paradox-numbers-api",
      provider: process.env.TELECOM_PROVIDER ?? "mock",
      time: new Date().toISOString(),
    };
  });

  await app.register(accountsRoutes, { prefix: "/api/v1" });
  await app.register(numbersRoutes, { prefix: "/api/v1" });
  await app.register(rentalsRoutes, { prefix: "/api/v1" });
  await app.register(messagesRoutes, { prefix: "/api/v1" });
  await app.register(billingRoutes, { prefix: "/api/v1" });

  return app;
}
