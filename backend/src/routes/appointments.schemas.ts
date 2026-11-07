import { AppointmentStatus, WorkShift } from "@prisma/client";
import { z } from "zod";

export const appointmentCreateSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(30),
    petId: z.string().trim().min(1).max(30).nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    shift: z.nativeEnum(WorkShift).nullable().optional(),
    reason: z.string().trim().min(1).max(255),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine(({ startsAt, endsAt }) => endsAt > startsAt, {
    message: "La hora de término debe ser posterior al inicio.",
    path: ["endsAt"],
  })
  .refine(({ startsAt, endsAt }) => endsAt.getTime() - startsAt.getTime() <= 12 * 60 * 60 * 1000, {
    message: "La cita no puede durar más de 12 horas.",
    path: ["endsAt"],
  });

export const appointmentStatusSchema = z
  .object({ status: z.nativeEnum(AppointmentStatus) })
  .strict();

export const appointmentRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .strict()
  .refine(({ from, to }) => to > from && to.getTime() - from.getTime() <= 32 * 24 * 60 * 60 * 1000, {
    message: "El rango debe ser válido y no superar 32 días.",
  });