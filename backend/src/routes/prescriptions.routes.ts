import { Prisma, UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  authorizeRoles,
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { HttpError } from "../lib/http-error";
import { generatePrescriptionDocument } from "../lib/prescription-template";
import { prisma } from "../lib/prisma";
import {
  parseBody,
  parseRecordId,
  prescriptionDataSchema,
} from "./clinical.schemas";

export const prescriptionsRouter = Router();
const prescriptionRoles: UserRole[] = [UserRole.ADMIN, UserRole.VETERINARIAN];

prescriptionsRouter.use(requireAuth, authorizeRoles(...prescriptionRoles));

prescriptionsRouter.get(
  "/consultations/:consultationId/prescription",
  asyncHandler(async (request, response) => {
    const consultationId = parseRecordId(request.params.consultationId);
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        pet: { include: { owner: true } },
      },
    });
    if (!consultation) throw new HttpError(404, "No se encontró la consulta.");
    const currentUser = getAuthenticatedUser(response);

    const prescription = await prisma.prescription.findUnique({
      where: { consultationId },
      include: { author: { select: { name: true } } },
    });
    const treatmentSuggestions = await prisma.treatment.findMany({
      where: {
        petId: consultation.petId,
        startsAt: { lte: consultation.occurredAt },
        OR: [
          { endsAt: null },
          { endsAt: { gte: consultation.occurredAt } },
        ],
      },
      orderBy: { startsAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        dosage: true,
        instructions: true,
        startsAt: true,
        endsAt: true,
      },
    });

    response.json({
      data: {
        consultation: {
          id: consultation.id,
          occurredAt: consultation.occurredAt,
          pet: {
            id: consultation.pet.id,
            ownerId: consultation.pet.ownerId,
            name: consultation.pet.name,
            species: consultation.pet.species,
            breed: consultation.pet.breed,
            sex: consultation.pet.sex,
            birthDate: consultation.pet.birthDate,
            weightKg: consultation.pet.weightKg,
            owner: {
              id: consultation.pet.owner.id,
              firstName: consultation.pet.owner.firstName,
              lastName: consultation.pet.owner.lastName,
              phone: consultation.pet.owner.phone,
            },
          },
        },
        recipe: prescription
          ? {
              id: prescription.id,
              generatedAt: prescription.generatedAt,
              veterinarianName: prescription.author.name,
            }
          : null,
        prescription: prescription
          ? prescriptionDataSchema.parse(prescription.data)
          : {
              ...createInitialPrescriptionData(consultation),
              veterinarianName: currentUser.name,
            },
        treatmentSuggestions,
      },
    });
  }),
);

prescriptionsRouter.post(
  "/consultations/:consultationId/prescription/preview",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const consultationId = parseRecordId(request.params.consultationId);
    const parsedData = parseBody(prescriptionDataSchema, request.body);
    const currentUser = getAuthenticatedUser(response);
    const data = {
      ...parsedData,
      veterinarianName: currentUser.name,
      medications: parsedData.medications.filter((medication) =>
        Object.values(medication).some((value) => value.length > 0),
      ),
    };
    const exists = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "No se encontró la consulta.");

    const document = await generatePrescriptionDocument(data);
    response
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .setHeader(
        "Content-Disposition",
        `inline; filename="vista-previa-receta-${consultationId}.docx"`,
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);

prescriptionsRouter.put(
  "/consultations/:consultationId/prescription",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const consultationId = parseRecordId(request.params.consultationId);
    const parsedData = parseBody(prescriptionDataSchema, request.body);
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, petId: true, pet: { select: { ownerId: true } } },
    });
    if (!consultation) throw new HttpError(404, "No se encontró la consulta.");

    const user = getAuthenticatedUser(response);
    const data = {
      ...parsedData,
      veterinarianName: user.name,
      medications: parsedData.medications.filter((medication) =>
        Object.values(medication).some((value) => value.length > 0),
      ),
    };
    const prescription = await prisma.prescription.upsert({
      where: { consultationId },
      create: {
        consultationId,
        petId: consultation.petId,
        ownerId: consultation.pet.ownerId,
        authorId: user.id,
        data: data as Prisma.InputJsonValue,
      },
      update: {
        petId: consultation.petId,
        ownerId: consultation.pet.ownerId,
        authorId: user.id,
        data: data as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
      select: { id: true, consultationId: true, generatedAt: true },
    });

    response.json({ data: prescription });
  }),
);

prescriptionsRouter.get(
  "/consultations/:consultationId/prescription/document",
  asyncHandler(async (request, response) => {
    const consultationId = parseRecordId(request.params.consultationId);
    const prescription = await prisma.prescription.findUnique({
      where: { consultationId },
    });
    if (!prescription) {
      throw new HttpError(404, "Guarda la receta antes de generar el documento.");
    }

    const data = prescriptionDataSchema.parse(prescription.data);
    const document = await generatePrescriptionDocument(data);
    response
      .setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .setHeader(
        "Content-Disposition",
        `inline; filename="receta-${consultationId}.docx"`,
      )
      .setHeader("Cache-Control", "no-store")
      .send(document);
  }),
);

function createInitialPrescriptionData(consultation: {
  occurredAt: Date;
  reason: string;
  diagnosis: string | null;
  notes: string | null;
  weightKg: Prisma.Decimal | null;
  pet: {
    name: string;
    species: string;
    breed: string | null;
    sex: "MALE" | "FEMALE" | "UNKNOWN";
    birthDate: Date | null;
    weightKg: Prisma.Decimal | null;
    owner: { firstName: string; lastName: string; phone: string };
  };
}): ReturnType<typeof prescriptionDataSchema.parse> {
  const consultationDate = consultation.occurredAt.toISOString().slice(0, 10);
  const sexLabels = {
    MALE: "Macho",
    FEMALE: "Hembra",
    UNKNOWN: "No especificado",
  };

  return {
    date: consultationDate,
    ownerName: `${consultation.pet.owner.firstName} ${consultation.pet.owner.lastName}`,
    ownerPhone: consultation.pet.owner.phone,
    petName: consultation.pet.name,
    species: consultation.pet.species,
    breed: consultation.pet.breed ?? "",
    sex: sexLabels[consultation.pet.sex],
    age: consultation.pet.birthDate
      ? formatAgeAtDate(consultation.pet.birthDate, consultation.occurredAt)
      : "",
    weight: consultation.weightKg
      ? `${consultation.weightKg.toString()} kg`
      : consultation.pet.weightKg
        ? `${consultation.pet.weightKg.toString()} kg`
        : "",
    diagnosis: [consultation.reason, consultation.diagnosis]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" — "),
    medications: [],
    recommendations: consultation.notes ?? "",
    veterinarianName: "",
  };
}

function formatAgeAtDate(birthDate: Date, referenceDate: Date): string {
  let years = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  let months = referenceDate.getUTCMonth() - birthDate.getUTCMonth();
  if (referenceDate.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0 || (years === 0 && months < 0)) return "";
  if (years < 1 && months < 1) return "Menos de 1 mes";
  if (years < 1) return `${months} ${months === 1 ? "mes" : "meses"}`;
  if (months === 0) return `${years} ${years === 1 ? "año" : "años"}`;
  return `${years} a ${months} m`;
}
