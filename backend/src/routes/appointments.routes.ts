import { AppointmentStatus, UserRole } from "@prisma/client";
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
  appointmentCreateSchema,
  appointmentRangeSchema,
  appointmentStatusSchema,
} from "./appointments.schemas";

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

appointmentsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const range = appointmentRangeSchema.parse(request.query);
    const appointments = await prisma.appointment.findMany({
      where: {
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        reason: true,
        status: true,
        shift: true,
        notes: true,
        owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
        pet: { select: { id: true, name: true, species: true } },
        veterinarian: { select: { id: true, name: true } },
      },
    });
    response.json({ data: appointments });
  }),
);

appointmentsRouter.post(
  "/",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const data = parseBody(appointmentCreateSchema, request.body);
    const owner = await prisma.owner.findUnique({
      where: { id: data.ownerId },
      select: { id: true },
    });
    if (!owner) throw new HttpError(400, "Selecciona un propietario registrado.");

    if (data.petId) {
      const pet = await prisma.pet.findUnique({
        where: { id: data.petId },
        select: { ownerId: true },
      });
      if (!pet || pet.ownerId !== data.ownerId) {
        throw new HttpError(400, "La mascota debe pertenecer al propietario seleccionado.");
      }
    }

    const authUser = getAuthenticatedUser(response);
    const appointment = await prisma.appointment.create({
      data: {
        ...data,
        petId: data.petId ?? null,
        createdById: authUser.id,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        reason: true,
        status: true,
        shift: true,
        owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
        pet: { select: { id: true, name: true, species: true } },
      },
    });
    response.status(201).json({ data: appointment });
  }),
);

appointmentsRouter.patch(
  "/:id/status",
  requireTrustedOrigin,
  authorizeRoles(UserRole.ADMIN, UserRole.VETERINARIAN, UserRole.RECEPTIONIST),
  asyncHandler(async (request, response) => {
    const id = parseRecordId(request.params.id);
    const { status } = parseBody(appointmentStatusSchema, request.body);
    const current = await prisma.appointment.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new HttpError(404, "No se encontró la cita.");
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      [AppointmentStatus.SCHEDULED]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    };
    if (!transitions[current.status].includes(status)) {
      throw new HttpError(409, "La cita no puede cambiar desde su estado actual.");
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    response.json({ data: appointment });
  }),
);