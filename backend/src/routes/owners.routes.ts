import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { authorizeRoles, requireAuth } from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import {
  ownerCreateSchema,
  ownerUpdateSchema,
  parseBody,
  parseListQuery,
  parseRecordId,
} from "./clinical.schemas";

export const ownersRouter = Router();

ownersRouter.use(requireAuth);

ownersRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { search, page, limit } = parseListQuery(request.query);
    const where = search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [owners, total] = await prisma.$transaction([
      prisma.owner.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          createdAt: true,
          _count: { select: { pets: true } },
        },
      }),
      prisma.owner.count({ where }),
    ]);

    response.json({ data: owners, page, limit, total });
  }),
);

ownersRouter.post(
  "/",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const data = parseBody(ownerCreateSchema, request.body);
    const owner = await prisma.owner.create({ data });
    response.status(201).json({ data: owner });
  }),
);

ownersRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const owner = await prisma.owner.findUnique({
      where: { id: parseRecordId(request.params.id) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        pets: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            sex: true,
            microchip: true,
          },
        },
      },
    });
    if (!owner) throw new HttpError(404, "No se encontró el propietario.");
    response.json({ data: owner });
  }),
);

ownersRouter.patch(
  "/:id",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const id = parseRecordId(request.params.id);
    const data = parseBody(ownerUpdateSchema, request.body);
    const result = await prisma.owner.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      throw new HttpError(404, "No se encontró el propietario.");
    }
    const owner = await prisma.owner.findUniqueOrThrow({
      where: { id },
    });
    response.json({ data: owner });
  }),
);
