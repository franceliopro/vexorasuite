import { Pool } from "pg";
import { loadConfig, publicConfig } from "./config.js";
import { createWebhookHandler } from "./handler.js";
import { createTelephonyServer } from "./server.js";
import { PostgresEventStore } from "./store.js";

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const store = new PostgresEventStore(pool);
const handler = createWebhookHandler({
  tenants: config.tenants,
  store,
  toleranceSeconds: config.toleranceSeconds,
  mode: config.mode,
});
const server = createTelephonyServer({ config, handler });

server.listen(config.port, config.host, () => {
  console.log(`Telefonia ouvindo em ${config.host}:${config.port}`, publicConfig(config));
  if (config.mode === "simulation") {
    console.log("Modo simulação: nenhuma chamada, mensagem ou IA é disparada daqui.");
  }
});
