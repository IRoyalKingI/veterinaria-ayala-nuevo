import { isAxiosError } from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";

export type UserRole = "ADMIN" | "VETERINARIAN" | "RECEPTIONIST";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type AuthStatus =
  | "checking"
  | "authenticated"
  | "anonymous"
  | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getApiError(error: unknown): string {
  if (
    isAxiosError<{ error?: string }>(error) &&
    typeof error.response?.data?.error === "string"
  ) {
    return error.response.data.error;
  }
  return "No se pudo conectar con el servicio. Inténtalo de nuevo.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);

  const retrySession = useCallback(() => {
    setStatus("checking");
    setError(null);
    setSessionAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;

    api
      .get<{ user: AuthUser }>("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        setStatus("authenticated");
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (isAxiosError(requestError) && requestError.response?.status === 401) {
          setUser(null);
          setStatus("anonymous");
          setError(null);
          return;
        }
        setUser(null);
        setStatus("unavailable");
        setError(getApiError(requestError));
      });

    return () => {
      active = false;
    };
  }, [sessionAttempt]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    setUser(data.user);
    setStatus("authenticated");
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ status, user, error, login, logout, retrySession }),
    [status, user, error, login, logout, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  }
  return context;
}

export function getLoginError(error: unknown): string {
  if (isAxiosError(error)) return getApiError(error);
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}
