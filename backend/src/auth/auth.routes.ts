import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth } from "../middleware/require-auth";
import { requireTrustedOrigin } from "../middleware/trusted-origin";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { AUTH_AUDIENCE, AUTH_COOKIE_NAME, AUTH_ISSUER } from "./auth.constants";

const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(191)
      .transform((email) => email.toLowerCase()),
    password: z
      .string()
      .min(1)
      .max(72)
      .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
  })
  .strict();

const dummyPasswordHash = bcrypt.hash(randomUUID(), 12);

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Inténtalo de nuevo más tarde." },
});

export const authRouter = Router();

authRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

authRouter.post(
  "/login",
  requireTrustedOrigin,
  loginRateLimit,
  asyncHandler(async (request, response) => {
    const credentials = loginSchema.safeParse(request.body);
    if (!credentials.success) {
      throw new HttpError(400, "Revisa el correo electrónico y la contraseña.");
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
    const passwordIsValid = await bcrypt.compare(
      credentials.data.password,
      passwordHash,
    );

    if (!user || !user.isActive || !passwordIsValid) {
      throw new HttpError(401, "Correo electrónico o contraseña incorrectos.");
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_TTL_SECONDS * 1000);

    await prisma.$transaction([
      prisma.authSession.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      }),
      prisma.authSession.create({
        data: { id: sessionId, userId: user.id, expiresAt },
      }),
    ]);

    const token = jwt.sign(
      {},
      env.JWT_SECRET,
      {
        algorithm: "HS256",
        subject: user.id,
        jwtid: sessionId,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
        expiresIn: env.JWT_TTL_SECONDS,
      },
    );

    response.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: env.JWT_TTL_SECONDS * 1000,
    });

    response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (_request, response) => {
    response.json({ user: response.locals.authUser });
  }),
);

authRouter.post(
  "/logout",
  requireTrustedOrigin,
  asyncHandler(async (request, response) => {
    const token = requestCookie(request.headers.cookie, AUTH_COOKIE_NAME);

    if (token) {
      try {
        const claims = jwt.verify(token, env.JWT_SECRET, {
          algorithms: ["HS256"],
          issuer: AUTH_ISSUER,
          audience: AUTH_AUDIENCE,
        });
        if (typeof claims !== "string" && claims.jti) {
          await prisma.authSession.deleteMany({ where: { id: claims.jti } });
        }
      } catch (error) {
        if (!(error instanceof jwt.JsonWebTokenError)) {
          throw error;
        }
      }
    }

    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    response.status(204).end();
  }),
);

function requestCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  const prefix = `${name}=`;
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}
