import { PetSex, WorkShift } from "@prisma/client";
import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .max(191)
  .email("Ingresa un correo válido.")
  .transform((email) => email.toLowerCase())
  .nullable()
  .optional();

export const ownerCreateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: optionalEmail,
    phone: z.string().trim().min(7).max(30),
    address: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export const ownerUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: optionalEmail,
    phone: z.string().trim().min(7).max(30).optional(),
    address: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

const optionalDate = z.coerce.date().nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const weightSchema = z.coerce.number().positive().max(99999).nullable().optional();

export const petCreateSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(100),
    species: z.string().trim().min(1).max(80),
    breed: optionalText(100),
    sex: z.nativeEnum(PetSex).default(PetSex.UNKNOWN),
    birthDate: optionalDate,
    color: optionalText(80),
    weightKg: weightSchema,
    microchip: z.string().trim().max(80).nullable().optional(),
    medicalNotes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export const petUpdateSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    species: z.string().trim().min(1).max(80).optional(),
    breed: optionalText(100),
    sex: z.nativeEnum(PetSex).optional(),
    birthDate: optionalDate,
    color: optionalText(80),
    weightKg: weightSchema,
    microchip: z.string().trim().max(80).nullable().optional(),
    medicalNotes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

export const petReceptionCreateSchema = petCreateSchema.omit({
  weightKg: true,
  medicalNotes: true,
});

export const petReceptionUpdateSchema = z
  .object({
    ownerId: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(1).max(100).optional(),
    species: z.string().trim().min(1).max(80).optional(),
    breed: optionalText(100),
    sex: z.nativeEnum(PetSex).optional(),
    birthDate: optionalDate,
    color: optionalText(80),
    microchip: z.string().trim().max(80).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

export const consultationCreateSchema = z
  .object({
    petId: z.string().trim().min(1).max(30),
    occurredAt: z.coerce.date().optional(),
    shift: z.nativeEnum(WorkShift).nullable().optional(),
    reason: z.string().trim().min(1).max(255),
    diagnosis: z.string().trim().max(10000).nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
    weightKg: weightSchema,
  })
  .strict();

const prescriptionMedicationSchema = z
  .object({
    name: z.string().trim().max(150),
    dosageFrequency: z.string().trim().max(150),
    durationInstructions: z.string().trim().max(500),
  })
  .strict();

export const prescriptionDataSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const [year, month, day] = value.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return (
          parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month - 1 &&
          parsed.getUTCDate() === day
        );
      }, "Ingresa una fecha válida."),
    ownerName: z.string().trim().max(201),
    ownerPhone: z.string().trim().max(50),
    petName: z.string().trim().max(100),
    species: z.string().trim().max(80),
    breed: z.string().trim().max(100),
    sex: z.string().trim().max(40),
    age: z.string().trim().max(60),
    weight: z.string().trim().max(40),
    diagnosis: z.string().trim().max(5000),
    medications: z.array(prescriptionMedicationSchema).max(5),
    recommendations: z.string().trim().max(5000),
    veterinarianName: z.string().trim().max(120),
  })
  .strict();

export const euthanasiaAuthorizationDataSchema = z
  .object({
    ownerName: z.string().trim().max(201),
    ownerPhone: z.string().trim().max(50),
    petName: z.string().trim().max(100),
    species: z.string().trim().max(80),
    breed: z.string().trim().max(100),
    age: z.string().trim().max(60),
    sex: z.string().trim().max(40),
    weight: z.string().trim().max(40),
    address: z.string().trim().max(255),
    identification: z.string().trim().max(80),
    documentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const [year, month, day] = value.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return (
          parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month - 1 &&
          parsed.getUTCDate() === day
        );
      }, "Ingresa una fecha válida."),
    diagnosis: z.string().trim().max(5000),
    prognosis: z.string().trim().max(5000),
    alternatives: z.string().trim().max(5000),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).or(z.literal("")),
    place: z.string().trim().max(255),
    otherDisposition: z.string().trim().max(1000),
  })
  .strict();

export const clinicalAnalysisDocumentDataSchema = z
  .object({
    ownerName: z.string().trim().max(201),
    ownerAddress: z.string().trim().max(255),
    ownerPhone: z.string().trim().max(50),
    recordNumber: z.string().trim().max(100),
    petName: z.string().trim().max(100),
    species: z.string().trim().max(80),
    breed: z.string().trim().max(100),
    sex: z.string().trim().max(40),
    age: z.string().trim().max(60),
    weight: z.string().trim().max(40),
    zoottechnicalFunction: z.string().trim().max(120),
    hemogramResults: z.array(z.string().trim().max(80)).length(12),
    proteinResult: z.string().trim().max(500),
    hemoparasites: z.string().trim().max(500),
    knottMethod: z.string().trim().max(500),
    observations: z.string().trim().max(2000),
    hepaticProfileResults: z.array(z.string().trim().max(80)).length(10),
  })
  .strict();

export const vaccineCreateSchema = z
  .object({
    petId: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(120),
    administeredAt: z.coerce.date(),
    shift: z.nativeEnum(WorkShift).nullable().optional(),
    nextDueAt: optionalDate,
    batchNumber: optionalText(100),
    notes: z.string().trim().max(10000).nullable().optional(),
  })
  .strict()
  .refine(
    ({ administeredAt, nextDueAt }) =>
      !nextDueAt || nextDueAt >= administeredAt,
    { message: "La próxima dosis no puede ser anterior a la aplicación." },
  );

export const treatmentCreateSchema = z
  .object({
    petId: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(150),
    dosage: optionalText(150),
    instructions: z.string().trim().max(10000).nullable().optional(),
    startsAt: z.coerce.date(),
    shift: z.nativeEnum(WorkShift).nullable().optional(),
    endsAt: optionalDate,
  })
  .strict()
  .refine(({ startsAt, endsAt }) => !endsAt || endsAt >= startsAt, {
    message: "La fecha de término no puede ser anterior al inicio.",
  });

export const listQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    petId: z.string().trim().min(1).max(30).optional(),
    ownerId: z.string().trim().min(1).max(30).optional(),
    species: z.string().trim().min(1).max(80).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export function parseRecordId(value: unknown): string {
  return z.string().trim().min(1).max(30).parse(value);
}

export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function parseListQuery(query: unknown) {
  const result = listQuerySchema.safeParse(query);
  if (!result.success) throw result.error;
  return result.data;
}
