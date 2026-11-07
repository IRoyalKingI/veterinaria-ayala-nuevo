import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  authorizeRoles,
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { prisma } from "../lib/prisma";
import {
  consultationCreateSchema,
  parseBody,
  parseListQuery,
  treatmentCreateSchema,
  vaccineCreateSchema,
} from "./clinical.schemas";

export const medicalRecordsRouter = Router();
const clinicalRoles: UserRole[] = [UserRole.ADMIN, UserRole.VETERINARIAN];

medicalRecordsRouter.use(requireAuth, authorizeRoles(...clinicalRoles));

medicalRecordsRouter.get(
  "/consultations",
  asyncHandler(async (request, response) => {
    const { petId, search, species, page, limit } = parseListQuery(request.query);
    const where = {
      ...(petId ? { petId } : {}),
      ...(species
        ? {
            pet: { species: { contains: species } },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search } },
              { diagnosis: { contains: search } },
              { notes: { contains: search } },
              { pet: { name: { contains: search } } },
            ],
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.consultation.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pet: { select: { id: true, name: true, species: true } },
          author: { select: { id: true, name: true } },
          prescription: { select: { id: true, generatedAt: true } },
        },
      }),
      prisma.consultation.count({ where }),
    ]);
    response.json({ data, page, limit, total });
  }),
);

medicalRecordsRouter.post(
  "/consultations",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const data = parseBody(consultationCreateSchema, request.body);
    const consultation = await prisma.consultation.create({
      data: { ...data, authorId: getAuthenticatedUser(response).id },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        author: { select: { id: true, name: true } },
      },
    });
    response.status(201).json({ data: consultation });
  }),
);

medicalRecordsRouter.get(
  "/vaccines",
  asyncHandler(async (request, response) => {
    const { petId, search, species, page, limit } = parseListQuery(request.query);
    const where = {
      ...(petId ? { petId } : {}),
      ...(species
        ? {
            pet: { species: { contains: species } },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { batchNumber: { contains: search } },
              { notes: { contains: search } },
              { pet: { name: { contains: search } } },
            ],
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.vaccine.findMany({
        where,
        orderBy: { administeredAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pet: { select: { id: true, name: true, species: true } },
          administrator: { select: { id: true, name: true } },
        },
      }),
      prisma.vaccine.count({ where }),
    ]);
    response.json({ data, page, limit, total });
  }),
);

medicalRecordsRouter.post(
  "/vaccines",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const data = parseBody(vaccineCreateSchema, request.body);
    const vaccine = await prisma.vaccine.create({
      data: { ...data, administratorId: getAuthenticatedUser(response).id },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        administrator: { select: { id: true, name: true } },
      },
    });
    response.status(201).json({ data: vaccine });
  }),
);

medicalRecordsRouter.get(
  "/treatments",
  asyncHandler(async (request, response) => {
    const { petId, search, species, page, limit } = parseListQuery(request.query);
    const where = {
      ...(petId ? { petId } : {}),
      ...(species
        ? {
            pet: { species: { contains: species } },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { instructions: { contains: search } },
              { pet: { name: { contains: search } } },
            ],
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.treatment.findMany({
        where,
        orderBy: { startsAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pet: { select: { id: true, name: true, species: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.treatment.count({ where }),
    ]);
    response.json({ data, page, limit, total });
  }),
);

medicalRecordsRouter.post(
  "/treatments",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const data = parseBody(treatmentCreateSchema, request.body);
    const treatment = await prisma.treatment.create({
      data: { ...data, authorId: getAuthenticatedUser(response).id },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        author: { select: { id: true, name: true } },
      },
    });
    response.status(201).json({ data: treatment });
  }),
);
