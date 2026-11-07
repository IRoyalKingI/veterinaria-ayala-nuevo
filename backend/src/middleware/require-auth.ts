import { UserRole } from "@prisma/client";
import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types";
import { env } from "../config/env";
import { AUTH_AUDIENCE, AUTH_COOKIE_NAME, AUTH_ISSUER } from "../auth/auth.constants";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "./async-handler";

const claimsSchema = z.object({
  sub: z.string().min(1),
  jti: z.string().uuid(),
});

export const requireAuth: RequestHandler = asyncHandler(
  async (request, response, next) => {
    const token = readCookie(request.headers.cookie, AUTH_COOKIE_NAME);
    if (!token) {
      throw new HttpError(401, "Autenticación requerida.");
    }

    let claims: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
      });
      if (typeof verified === "string") {
        throw new HttpError(401, "Sesión no válida.");
      }
      claims = verified;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof jwt.JsonWebTokenError) {
        throw new HttpError(401, "La sesión ha expirado o no es válida.");
      }
      throw error;
    }

    const parsedClaims = claimsSchema.safeParse(claims);
    if (!parsedClaims.success) {
      throw new HttpError(401, "Sesión no válida.");
    }

    const session = await prisma.authSession.findFirst({
      where: {
        id: parsedClaims.data.jti,
        userId: parsedClaims.data.sub,
        expiresAt: { gt: new Date() },
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session?.user.isActive) {
      throw new HttpError(401, "La sesión ya no está activa.");
    }

    response.locals.authUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    };
    next();
  },
);

export function authorizeRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (request, response, next) => {
    if (!response.locals.authUser) {
      next(new HttpError(401, "Autenticación requerida."));
      return;
    }

    if (!allowedRoles.includes(response.locals.authUser.role)) {
      next(new HttpError(403, "No tienes permiso para realizar esta acción."));
      return;
    }

    next();
  };
}

export function getAuthenticatedUser(response: Response): AuthenticatedUser {
  const user = response.locals.authUser;
  if (!user) throw new HttpError(401, "Autenticación requerida.");
  return user;
}

function readCookie(
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
