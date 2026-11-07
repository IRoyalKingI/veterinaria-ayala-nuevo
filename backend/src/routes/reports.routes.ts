import { AppointmentStatus, WorkShift } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/require-auth";
import { prisma } from "../lib/prisma";

const reportRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    shift: z.enum(["ALL", "MORNING", "AFTERNOON"]).default("ALL"),
  })
  .strict()
  .refine(
    ({ from, to }) =>
      to >= from && to.getTime() - from.getTime() <= 365 * 24 * 60 * 60 * 1000,
    { message: "El periodo debe ser válido y no superar 366 días." },
  );

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const { from, to, shift } = reportRangeSchema.parse(request.query);
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const shiftFilter =
      shift === "ALL"
        ? {}
        : { shift: shift as WorkShift };
    const appointmentPeriod = {
      startsAt: { gte: from, lt: toExclusive },
    };
    const consultationPeriod = {
      occurredAt: { gte: from, lt: toExclusive },
    };
    const vaccinePeriod = {
      administeredAt: { gte: from, lt: toExclusive },
    };
    const treatmentPeriod = {
      startsAt: { gte: from, lt: toExclusive },
    };

    const [
      owners,
      pets,
      speciesGroups,
      appointmentGroups,
      consultations,
      vaccines,
      treatments,
      appointmentsByShift,
      consultationsByShift,
      vaccinesByShift,
      treatmentsByShift,
    ] = await Promise.all([
      prisma.owner.count(),
      prisma.pet.count(),
      prisma.pet.groupBy({
        by: ["species"],
        _count: { _all: true },
        orderBy: { species: "asc" },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { ...appointmentPeriod, ...shiftFilter },
        _count: { _all: true },
      }),
      prisma.consultation.count({
        where: { ...consultationPeriod, ...shiftFilter },
      }),
      prisma.vaccine.count({
        where: { ...vaccinePeriod, ...shiftFilter },
      }),
      prisma.treatment.count({
        where: { ...treatmentPeriod, ...shiftFilter },
      }),
      prisma.appointment.groupBy({
        by: ["shift"],
        where: appointmentPeriod,
        _count: { _all: true },
      }),
      prisma.consultation.groupBy({
        by: ["shift"],
        where: consultationPeriod,
        _count: { _all: true },
      }),
      prisma.vaccine.groupBy({
        by: ["shift"],
        where: vaccinePeriod,
        _count: { _all: true },
      }),
      prisma.treatment.groupBy({
        by: ["shift"],
        where: treatmentPeriod,
        _count: { _all: true },
      }),
    ]);

    const appointmentsByStatus: Record<AppointmentStatus, number> = {
      [AppointmentStatus.SCHEDULED]: 0,
      [AppointmentStatus.CONFIRMED]: 0,
      [AppointmentStatus.COMPLETED]: 0,
      [AppointmentStatus.CANCELLED]: 0,
      [AppointmentStatus.NO_SHOW]: 0,
    };
    for (const group of appointmentGroups) {
      appointmentsByStatus[group.status] = group._count._all;
    }
    const speciesDistribution = speciesGroups.map((group) => ({
      species: group.species,
      total: group._count._all,
      percentage: pets === 0 ? 0 : (group._count._all / pets) * 100,
    }));

    response.json({
      data: {
        general: { owners, pets, speciesDistribution },
        period: {
          appointments: {
            total: Object.values(appointmentsByStatus).reduce(
              (total, count) => total + count,
              0,
            ),
            byStatus: appointmentsByStatus,
          },
          consultations,
          vaccines,
          treatments,
          activityByShift: {
            MORNING: {
              appointments: countShift(appointmentsByShift, WorkShift.MORNING),
              consultations: countShift(consultationsByShift, WorkShift.MORNING),
              vaccines: countShift(vaccinesByShift, WorkShift.MORNING),
              treatments: countShift(treatmentsByShift, WorkShift.MORNING),
            },
            AFTERNOON: {
              appointments: countShift(appointmentsByShift, WorkShift.AFTERNOON),
              consultations: countShift(consultationsByShift, WorkShift.AFTERNOON),
              vaccines: countShift(vaccinesByShift, WorkShift.AFTERNOON),
              treatments: countShift(treatmentsByShift, WorkShift.AFTERNOON),
            },
            UNSPECIFIED: {
              appointments: countShift(appointmentsByShift, null),
              consultations: countShift(consultationsByShift, null),
              vaccines: countShift(vaccinesByShift, null),
              treatments: countShift(treatmentsByShift, null),
            },
          },
        },
      },
    });
  }),
);

function countShift(
  groups: Array<{ shift: WorkShift | null; _count: { _all: number } }>,
  shift: WorkShift | null,
): number {
  return groups.find((group) => group.shift === shift)?._count._all ?? 0;
}
