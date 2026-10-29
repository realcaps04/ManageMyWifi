import { env } from "./config";
import { logger } from "./logger";
import { memoryStore } from "./db/memory-store";
import { createApp } from "./app";

const app = createApp();

// On Vercel the serverless entry exports the app — do not listen.
if (!process.env.VERCEL) {
  app.listen(env.API_PORT, env.API_HOST, () => {
    logger.info(
      {
        host: env.API_HOST,
        port: env.API_PORT,
        storage: "memory",
        networkId: memoryStore.network.id,
        networkName: memoryStore.network.name,
      },
      "ManageMyWifi API listening"
    );
  });
}

export default app;
