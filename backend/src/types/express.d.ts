import type { AuthenticatedUser } from "../auth/auth.types";

declare global {
  namespace Express {
    interface Locals {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
