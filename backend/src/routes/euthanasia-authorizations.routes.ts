import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { generateEuthanasiaAuthorizationDocument } from "../lib/euthanasia-authorization-template";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  euthanasiaAuthorizationDataSchema,
  parseBody,
  parseRecordId,
} from "./clinical.schemas";

export const euthanasiaAuthorizationsRouter = Router();

euthanasiaAuthorizationsRouter.use(requireAuth);

euthanasiaAuthorizationsRouter.get(
  "/:petId",
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const currentUser = getAuthenticatedUser(response);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        microchip: true,
        ...(currentUser.role === UserRole.RECEPTIONIST ? {} : { weightKg: true }),
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

    const history = await prisma.euthanasiaAuthorization.findMany({
      where: { petId },
      orderBy: { generatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        generatedAt: true,
        author: { select: { name: true } },
      },
    });

    response.json({
      data: {
        pet: {
          ...pet,
          weightKg: "weightKg" in pet ? pet.weightKg?.toString() ?? null : null,
        },
        history,
      },
    });
  }),
);

euthanasiaAuthorizationsRouter.post(
  "/:petId/preview",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const data = parseBody(euthanasiaAuthorizationDataSchema, request.body);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");
    const document = await generateEuthanasiaAuthorizationDocument(data);
    response
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .setHeader(
        "Content-Disposition",
        'inline; filename="vista-previa-autorizacion-eutanasia.docx"',
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);

euthanasiaAuthorizationsRouter.post(
  "/:petId/document",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const petId = parseRecordId(request.params.petId);
    const data = parseBody(euthanasiaAuthorizationDataSchema, request.body);
    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, ownerId: true },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");

    const document = await generateEuthanasiaAuthorizationDocument(data);
    const author = getAuthenticatedUser(response);
    await prisma.euthanasiaAuthorization.create({
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
        `inline; filename="autorizacion-eutanasia-${pet.id}.docx"`,
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);
