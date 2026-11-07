import { UserRole } from "@prisma/client";
import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(120);
const emailSchema = z
  .string()
  .trim()
  .email("Ingresa un correo válido.")
  .max(191)
  .transform((email) => email.toLowerCase());
const passwordSchema = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(72)
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
    message: "La contraseña no puede superar 72 bytes UTF-8.",
  });

export const userCreateSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.nativeEnum(UserRole),
    isActive: z.boolean().default(true),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

export const userListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
