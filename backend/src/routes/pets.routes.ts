import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import {
  authorizeRoles,
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  parseBody,
  parseListQuery,
  parseRecordId,
  petCreateSchema,
  petReceptionCreateSchema,
  petReceptionUpdateSchema,
  petUpdateSchema,
} from "./clinical.schemas";

export const petsRouter = Router();

petsRouter.use(requireAuth);

petsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { search, ownerId, page, limit } = parseListQuery(request.query);
    const authUser = getAuthenticatedUser(response);
    const where = {
      ...(ownerId ? { ownerId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { species: { contains: search } },
              { breed: { contains: search } },
              { microchip: { contains: search } },
              {
                owner: {
                  OR: [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { phone: { contains: search } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [pets, total] = await prisma.$transaction([
      prisma.pet.findMany({
        where,
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          ownerId: true,
          name: true,
          species: true,
          breed: true,
          sex: true,
          birthDate: true,
          color: true,
          ...(authUser.role === UserRole.RECEPTIONIST ? {} : { weightKg: true }),
          microchip: true,
          ...(authUser.role === UserRole.RECEPTIONIST ? {} : { medicalNotes: true }),
          owner: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      }),
      prisma.pet.count({ where }),
    ]);

    response.json({ data: pets, page, limit, total });
  }),
);

petsRouter.post(
  "/",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const authUser = getAuthenticatedUser(response);
    const data =
      authUser.role === UserRole.RECEPTIONIST
        ? parseBody(petReceptionCreateSchema, request.body)
        : parseBody(petCreateSchema, request.body);
    const pet = await prisma.pet.create({ data });
    response.status(201).json({ data: pet });
  }),
);

petsRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const authUser = getAuthenticatedUser(response);
    const pet = await prisma.pet.findUnique({
      where: { id: parseRecordId(request.params.id) },
      select: {
        id: true,
        ownerId: true,
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        color: true,
        microchip: true,
        ...(authUser.role === UserRole.RECEPTIONIST
          ? {}
          : { weightKg: true, medicalNotes: true }),
        owner: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });
    if (!pet) throw new HttpError(404, "No se encontró la mascota.");
    response.json({ data: pet });
  }),
);

petsRouter.patch(
  "/:id",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const id = parseRecordId(request.params.id);
    const authUser = getAuthenticatedUser(response);
    const data =
      authUser.role === UserRole.RECEPTIONIST
        ? parseBody(petReceptionUpdateSchema, request.body)
        : parseBody(petUpdateSchema, request.body);
    const result = await prisma.pet.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      throw new HttpError(404, "No se encontró la mascota.");
    }
    const pet = await prisma.pet.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        species: true,
        breed: true,
        sex: true,
        birthDate: true,
        color: true,
        microchip: true,
        ...(authUser.role === UserRole.RECEPTIONIST
          ? {}
          : { weightKg: true, medicalNotes: true }),
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    response.json({ data: pet });
  }),
);
