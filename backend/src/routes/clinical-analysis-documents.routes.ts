import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { generateClinicalAnalysisDocument } from "../lib/clinical-analysis-template";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  clinicalAnalysisDocumentDataSchema,
  parseBody,
  parseRecordId,
} from "./clinical.schemas";

export const clinicalAnalysisDocumentsRouter = Router();

clinicalAnalysisDocumentsRouter.use(requireAuth);
clinicalAnalysisDocumentsRouter.use((_request, response, next) => {
  const user = getAuthenticatedUser(response);
  if (user.role === UserRole.RECEPTIONIST) {
    next(new HttpError(403, "No tienes permiso para elaborar análisis clínicos."));
    return;
  }
  next();
});

clinicalAnalysisDocumentsRouter.get(
  "/:petId",
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        weightKg: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            address: true,
          },
        },
      },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");

    const history = await prisma.clinicalAnalysisDocument.findMany({
      where: { petId },
      orderBy: { generatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        generatedAt: true,
        data: true,
        author: { select: { name: true } },
      },
    });

    response.json({
      data: {
        pet: {
          ...pet,
          weightKg: pet.weightKg?.toString() ?? null,
        },
        history,
      },
    });
  }),
);

clinicalAnalysisDocumentsRouter.post(
  "/:petId/preview",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const data = parseBody(clinicalAnalysisDocumentDataSchema, request.body);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");

    const document = await generateClinicalAnalysisDocument(data);
    response
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .setHeader(
        "Content-Disposition",
        'inline; filename="vista-previa-analisis-clinicos.docx"',
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);

clinicalAnalysisDocumentsRouter.post(
  "/:petId/document",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const data = parseBody(clinicalAnalysisDocumentDataSchema, request.body);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, ownerId: true },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");

    const document = await generateClinicalAnalysisDocument(data);
    const author = getAuthenticatedUser(response);
    await prisma.clinicalAnalysisDocument.create({
      data: {
        petId: pet.id,
        ownerId: pet.ownerId,
        authorId: author.id,
        data,
      },
    });

    response
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .setHeader(
        "Content-Disposition",
        `inline; filename="analisis-clinicos-${pet.id}.docx"`,
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);
