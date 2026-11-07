import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  console.info(`API disponible en http://localhost:${env.PORT}/api/v1`);
});

function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error("No se pudo cerrar el servidor de forma ordenada:", error);
      process.exitCode = 1;
    }
    void prisma.$disconnect();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
