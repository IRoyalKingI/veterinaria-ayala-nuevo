import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ThemeToggle } from "../theme/ThemeContext";
import { getLoginError, useAuth } from "./AuthContext";

export default function LoginPage() {
  const { login, status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (status === "authenticated") return <Navigate to="/" replace />;
  if (status === "checking") {
    return <LoadingScreen message="Verificando la sesión segura..." />;
  }
  if (status === "unavailable") {
    return <ServiceUnavailable />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError: unknown) {
      setError(getLoginError(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-identity" aria-label="Clínica Veterinaria Ayala">
        <div className="login-photo login-photo--dog" aria-hidden="true" />
        <div className="login-photo login-photo--cat" aria-hidden="true" />
        <span className="login-orbit login-orbit--top" aria-hidden="true" />
        <span className="login-orbit login-orbit--bottom" aria-hidden="true" />
        <div className="login-brand">
          <BrandLogo light large />
        </div>
        <div className="login-story">
          <p className="login-kicker">
            <span className="login-kicker-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
              </svg>
            </span>
            Atención veterinaria
          </p>
          <h1>Cada paciente merece una atención cercana.</h1>
          <p className="login-story-copy">
            Cuidamos de quienes hacen especial cada día, con una atención
            profesional y cercana.
          </p>
          <div className="login-trust">
            <span className="login-trust-dot" />
            Gestión clínica segura para nuestro equipo
          </div>
        </div>
        <p className="login-identity-footer">
          Clínica Veterinaria Ayala <span aria-hidden="true">·</span> Cuidado
          con confianza
        </p>
      </section>

      <section className="login-panel">
        <ThemeToggle className="login-theme-toggle" />
        <div className="login-form-wrap">
          <div className="login-heading">
            <p className="login-eyebrow">Portal del equipo</p>
            <h2>Bienvenido de nuevo</h2>
            <p className="login-intro">
              Inicia sesión para acceder al sistema de gestión de Clínica
              Veterinaria Ayala.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Correo electrónico</label>
              <div className="login-input-wrap">
                <svg
                  aria-hidden="true"
                  className="login-input-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <rect
                    height="15"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    width="18"
                    x="3"
                    y="4.5"
                  />
                  <path
                    d="m4 7 8 6 8-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
                <input
                  autoComplete="username"
                  disabled={submitting}
                  id="email"
                  maxLength={191}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@clinica.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <div className="login-input-wrap">
                <svg
                  aria-hidden="true"
                  className="login-input-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <rect
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    width="16"
                    x="4"
                    y="10"
                  />
                  <path
                    d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v2"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  />
                </svg>
                <input
                  autoComplete="current-password"
                  disabled={submitting}
                  id="password"
                  maxLength={72}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Tu contraseña"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  className="login-password-toggle"
                  disabled={submitting}
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? (
                    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a15.5 15.5 0 0 1-3.1 3.8M6.2 6.2C4.1 7.6 3 12 3 12s3.5 7 9 7c1 0 1.9-.2 2.7-.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="2.5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
                  <circle
                    cx="10"
                    cy="10"
                    r="7.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M10 6.5v4m0 3h.01"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
                {error}
              </p>
            )}

            <button
              className="login-submit"
              disabled={submitting}
              type="submit"
            >
              <span>{submitting ? "Verificando..." : "Iniciar sesión"}</span>
              {!submitting && (
                <svg
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M4 10h12m-5-5 5 5-5 5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
              )}
            </button>
          </form>

          <div className="login-form-footer">
            <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
              <rect
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                width="12"
                x="4"
                y="9"
              />
              <path
                d="M7 9V6a3 3 0 0 1 6 0v3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
            <p>
              ¿Necesitas acceso? Solicítalo al administrador de la clínica. Tu
              sesión se mantiene en una cookie protegida.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <main
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-subtle px-6 text-primary"
    >
      <div className="rounded-2xl border border-line bg-surface-raised px-8 py-7 text-center shadow-card">
        <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-ayala-blue/20 border-t-ayala-green" />
        <p className="mt-4 text-sm text-muted">{message}</p>
      </div>
    </main>
  );
}

export function ServiceUnavailable() {
  const { error, retrySession } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-subtle px-6 text-primary">
      <section className="max-w-md rounded-2xl border border-line bg-surface-raised p-8 text-center shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">
          Servicio no disponible
        </p>
        <h1 className="mt-3 text-xl font-semibold text-ayala-blue">
          No se pudo verificar la sesión
        </h1>
        <p         className="mt-3 text-sm leading-6 text-muted">
          {error ?? "Comprueba que el servicio esté iniciado e inténtalo de nuevo."}
        </p>
        <button
          className="mt-6 rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white"
          onClick={retrySession}
          type="button"
        >
          Reintentar conexión
        </button>
      </section>
    </main>
  );
}

export function BrandLogo({
  compact = false,
  light = false,
  large = false,
}: {
  compact?: boolean;
  light?: boolean;
  large?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const markSize = large
    ? "h-24 w-24 sm:h-28 sm:w-28"
    : compact
      ? "h-10 w-10"
      : "h-12 w-12";
  const textPrimary = light ? "text-white" : "text-primary";
  const textSecondary = light ? "text-blue-100" : "text-ayala-blue";
  const headingClass = large ? "text-base sm:text-lg" : "text-sm";
  const subheadingClass = large ? "text-xs sm:text-sm" : "text-[10px]";

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {!imageError ? (
        <img
          alt="Logo Clínica Veterinaria Ayala"
          className={`${markSize} ${large ? "brand-logo-mark" : ""} rounded-2xl bg-white object-contain ring-2 ${light ? "ring-white/20" : "ring-ayala-blue/10"}`}
          onError={() => setImageError(true)}
          src="/images/logo-clinica-ayala.png"
        />
      ) : (
        <span
          className={`${markSize} flex items-center justify-center rounded-2xl ${light ? "bg-white text-ayala-blue" : "bg-ayala-blue text-white"} text-lg font-bold`}
        >
          A
        </span>
      )}
      <span>
        <span className={`block font-bold tracking-wide ${textPrimary} ${headingClass}`}>
          CLÍNICA VETERINARIA
        </span>
        <span className={`block font-semibold tracking-[0.22em] ${textSecondary} ${subheadingClass}`}>
          AYALA
        </span>
      </span>
    </div>
  );
}
