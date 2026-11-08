import { buildApp } from "./app";

const start = async () => {
  const app = await buildApp();
  const port = Number(process.env.API_PORT) || 3001;
  const host = process.env.API_HOST || "0.0.0.0";

  try {
    await app.listen({ port, host });
    console.log(`Paradox Numbers API running on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();