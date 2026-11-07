import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { authRouter } from "./auth/auth.routes";
import { env } from "./config/env";
import { HttpError } from "./lib/http-error";
import { appointmentsRouter } from "./routes/appointments.routes";
import { clinicalAnalysisDocumentsRouter } from "./routes/clinical-analysis-documents.routes";
import { euthanasiaAuthorizationsRouter } from "./routes/euthanasia-authorizations.routes";
import { healthRouter } from "./routes/health.routes";
import { medicalRecordsRouter } from "./routes/medical-records.routes";
import { ownersRouter } from "./routes/owners.routes";
import { petsRouter } from "./routes/pets.routes";
import { prescriptionsRouter } from "./routes/prescriptions.routes";
import { reportsRouter } from "./routes/reports.routes";
import { usersRouter } from "./routes/users.routes";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/appointments", appointmentsRouter);
app.use("/api/v1/documents/clinical-analysis", clinicalAnalysisDocumentsRouter);
app.use("/api/v1/documents/euthanasia", euthanasiaAuthorizationsRouter);
app.use("/api/v1/owners", ownersRouter);
app.use("/api/v1/pets", petsRouter);
app.use("/api/v1/clinical", prescriptionsRouter);
app.use("/api/v1/clinical", medicalRecordsRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/users", usersRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Ruta no encontrada" });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Los datos enviados no son válidos.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({
        error: "Ya existe un registro con uno de los datos únicos enviados.",
      });
      return;
    }
    if (error.code === "P2003") {
      response.status(409).json({
        error: "No se puede modificar el registro porque tiene información relacionada.",
      });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({ error: "No se encontró el registro solicitado." });
      return;
    }
    if (["P1000", "P1001", "P1002", "P1008", "P1017"].includes(error.code)) {
      console.error("MySQL no está disponible para la solicitud:", error.code);
      response.status(503).json({
        error: "La base de datos no está disponible. Inténtalo de nuevo más tarde.",
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("No se pudo establecer conexión con MySQL:", error.message);
    response.status(503).json({
      error: "La base de datos no está disponible. Inténtalo de nuevo más tarde.",
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    (error.status === 400 || error.status === 413)
  ) {
    response.status(error.status).json({
      error:
        error.status === 413
          ? "El cuerpo de la solicitud supera el límite permitido."
          : "El cuerpo de la solicitud no contiene JSON válido.",
    });
    return;
  }

  console.error("Error no controlado en la API:", error);
  response.status(500).json({ error: "Error interno del servidor" });
};

app.use(errorHandler);
