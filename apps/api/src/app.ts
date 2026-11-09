import Fastify from "fastify";
import { numbersRoutes } from "./modules/numbers/numbers.routes";
import { rentalsRoutes } from "./modules/rentals/rentals.routes";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    return { status: "ok", service: "paradox-numbers-api" };
  });

  await app.register(numbersRoutes, { prefix: "/api/v1" });
  await app.register(rentalsRoutes, { prefix: "/api/v1" });

  return app;
}