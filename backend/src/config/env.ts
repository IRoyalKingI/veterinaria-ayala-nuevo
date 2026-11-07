import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine((secret) => !secret.startsWith("CAMBIAR_"), {
      message: "JWT_SECRET debe ser un secreto aleatorio, no el valor de ejemplo",
    }),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(
    `Configuración de entorno inválida: ${parsedEnvironment.error.message}`,
  );
}

export const env = parsedEnvironment.data;
