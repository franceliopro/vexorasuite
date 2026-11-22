import { createProvisionerServer } from "./api.js";
import { loadConfig } from "./config.js";

const port = Number(process.env.PORT ?? "3001");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535");
}

const config = loadConfig();
const server = createProvisionerServer({ config });
server.listen(port, "127.0.0.1", () => {
  console.log(
    `Provisionador em modo ${config.mode} ouvindo em http://127.0.0.1:${port}`,
  );
  if (config.mode === "simulation") {
    console.log("Modo simulação: nenhum recurso real é criado.");
  }
});
