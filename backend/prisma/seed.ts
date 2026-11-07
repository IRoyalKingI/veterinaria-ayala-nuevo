import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrador";

  if (
    !email ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error(
      "Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (12-72 bytes UTF-8) para crear el administrador inicial.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { role: true, isActive: true },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.ADMIN || !existingUser.isActive) {
      throw new Error(
        `Ya existe ${email} como cuenta inactiva o con un rol distinto de administrador; no se modificó la cuenta.`,
      );
    }
    console.info(`El administrador inicial ya existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, role: UserRole.ADMIN },
  });

  console.info(`Administrador inicial creado: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error("No se pudo completar el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
