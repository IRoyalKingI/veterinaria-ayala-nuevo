import type { RequestHandler } from "express";
import { env } from "../config/env";
import { HttpError } from "../lib/http-error";

export const requireTrustedOrigin: RequestHandler = (
  request,
  _response,
  next,
) => {
  const origin = request.get("origin");

  if (origin !== env.CLIENT_ORIGIN) {
    next(new HttpError(403, "Origen de solicitud no permitido"));
    return;
  }

  next();
};
