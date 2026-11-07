import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
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
import { parseBody, parseRecordId } from "./clinical.schemas";
import {
  userCreateSchema,
  userListQuerySchema,
  userUpdateSchema,
} from "./users.schemas";

export const usersRouter = Router();
const userManagementRoles: UserRole[] = [UserRole.ADMIN, UserRole.VETERINARIAN];

usersRouter.use(requireAuth, authorizeRoles(...userManagementRoles));

usersRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const { search, page, limit } = userListQuerySchema.parse(request.query);
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    response.json({ data: users, page, limit, total });
  }),
);

usersRouter.post(
  "/",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const data = parseBody(userCreateSchema, request.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    response.status(201).json({ data: user });
  }),
);

usersRouter.patch(
  "/:id",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const id = parseRecordId(request.params.id);
    const data = parseBody(userUpdateSchema, request.body);
    const currentUser = getAuthenticatedUser(response);
    const passwordHash = data.password
      ? await bcrypt.hash(data.password, 12)
      : undefined;

    try {
      const user = await prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.user.findUnique({
            where: { id },
            select: { id: true, role: true, isActive: true },
          });
          if (!existing) throw new HttpError(404, "No se encontró el usuario.");

          if (
            existing.id === currentUser.id &&
            ((data.role && data.role !== existing.role) || data.isActive === false)
          ) {
            throw new HttpError(
              409,
              "No puedes cambiar tu propio rol ni desactivar tu cuenta.",
            );
          }

          const removingLastActiveAdmin =
            existing.role === UserRole.ADMIN &&
            existing.isActive &&
            (data.role !== undefined && data.role !== UserRole.ADMIN
              ? true
              : data.isActive === false);
          if (removingLastActiveAdmin) {
            const activeAdmins = await transaction.user.count({
              where: { role: UserRole.ADMIN, isActive: true },
            });
            if (activeAdmins <= 1) {
              throw new HttpError(
                409,
                "No se puede cambiar o desactivar la última cuenta administradora activa.",
              );
            }
          }

          const updatedUser = await transaction.user.update({
            where: { id },
            data: {
              name: data.name,
              email: data.email,
              role: data.role,
              isActive: data.isActive,
              ...(passwordHash ? { passwordHash } : {}),
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          });

          if (passwordHash) {
            await transaction.authSession.deleteMany({ where: { userId: id } });
          }

          return updatedUser;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      response.json({ data: user });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new HttpError(
          409,
          "El usuario cambió durante la operación. Actualiza la lista e inténtalo de nuevo.",
        );
      }
      throw error;
    }
  }),
);
