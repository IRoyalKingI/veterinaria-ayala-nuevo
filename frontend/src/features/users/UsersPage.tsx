import { useCallback, useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "../../auth/AuthContext";
import { api } from "../../lib/api";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

interface ListResult<T> {
  data: T[];
  total: number;
}

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  VETERINARIAN: "Veterinario/a",
  RECEPTIONIST: "Recepción",
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15";

export default function UsersPage() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ListResult<ManagedUser> & { page: number }>(
        "/users",
        { params: { search: search.trim() || undefined, page, limit: 25 } },
      );
      setUsers(data.data);
      setTotal(data.total);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setLoading(false);
    }
  }, [page, refreshKey, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 180);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const isEditingSelf = editing?.id === currentUser?.id;
    const role = parseRole(formData.get("role"));
    const payload: {
      name: string;
      email: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    } = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      ...(password ? { password } : {}),
      ...(role ? { role } : {}),
      ...(editing
        ? {
            isActive: isEditingSelf
              ? editing.isActive
              : formData.has("isActive"),
          }
        : { isActive: formData.has("isActive") }),
    };

    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        if (isEditingSelf && password) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setNotice("Los datos del usuario se actualizaron correctamente.");
      } else {
        await api.post("/users", payload);
        setNotice("El usuario se creó correctamente.");
      }
      setEditing(null);
      setRefreshKey((key) => key + 1);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="users-page space-y-6">
      <div className="users-heading">
        <div className="users-heading-copy">
          <span className="users-heading-icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Administración del equipo
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
              Usuarios
            </h1>
            <p className="mt-2 text-sm text-muted">
              Administra las cuentas, los roles y el acceso al sistema.
            </p>
          </div>
        </div>
        <label className="users-search block w-full sm:max-w-xs">
          <span className="sr-only">Buscar usuarios</span>
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
            <path d="m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
          </svg>
          <input
            className={inputClass}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por nombre o correo..."
            type="search"
            value={search}
          />
        </label>
      </div>

      {error && (
        <p
          className="users-notice users-notice--error rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="users-notice users-notice--success rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="users-content-grid grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <section className="users-list-panel min-w-0 rounded-2xl border border-line bg-surface-raised shadow-card">
          <div className="users-list-heading flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="users-panel-eyebrow">ACCESO Y PERFILES</p>
              <h2 className="font-semibold text-primary">Cuentas del sistema</h2>
              <p className="mt-1 text-xs text-muted">
                {loading ? "Cargando..." : `${total} usuarios`}
              </p>
            </div>
            {!loading && (
              <span className="users-total-badge">
                <i />
                {total} {total === 1 ? "cuenta" : "cuentas"}
              </span>
            )}
          </div>
          {loading ? (
            <div aria-live="polite" className="users-loading">
              <span /><span /><span />
            </div>
          ) : users.length === 0 ? (
            <div className="users-empty">
              <span>
                <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21" />
                </svg>
              </span>
              <h3>No hay usuarios para mostrar</h3>
              <p>Prueba otra búsqueda o crea una cuenta para el equipo.</p>
            </div>
          ) : (
            <div className="users-list">
              {users.map((managedUser) => (
                <article
                  className={`user-account-card${managedUser.id === currentUser?.id ? " is-current-user" : ""}`}
                  key={managedUser.id}
                >
                  <span className={`user-account-avatar user-account-avatar--${managedUser.role.toLowerCase()}`} aria-hidden="true">
                    {managedUser.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()}
                  </span>
                  <div className="user-account-main">
                    <div className="user-account-name-row">
                      <h3>{managedUser.name}</h3>
                      {managedUser.id === currentUser?.id && <span className="user-self-badge">Tu cuenta</span>}
                    </div>
                    <p className="user-account-email">{managedUser.email}</p>
                    <div className="user-account-badges">
                      <span className={`user-role-badge user-role-badge--${managedUser.role.toLowerCase()}`}>
                        <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3.5-11 2.3 2.3 4.7-4.7" />
                        </svg>
                        {roleLabels[managedUser.role]}
                      </span>
                      <span className={`user-status-badge${managedUser.isActive ? " is-active" : " is-inactive"}`}>
                        <i />
                        {managedUser.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>
                  <button
                    aria-label={`Administrar cuenta de ${managedUser.name}`}
                    className="user-manage-button"
                    onClick={() => setEditing(managedUser)}
                    type="button"
                  >
                    Administrar
                    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </article>
              ))}
            </div>
          )}
          {!loading && total > 25 && (
            <div className="users-pagination flex items-center justify-between border-t border-line px-5 py-4">
              <span className="text-xs text-muted">
                Página {page} de {Math.ceil(total / 25)}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  type="button"
                >
                  Anterior
                </button>
                <button
                  className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page >= Math.ceil(total / 25)}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>

        <form
          className="users-form h-fit space-y-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6"
          key={editing?.id ?? "new"}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="users-form-heading flex items-start justify-between gap-3">
            <div>
              <p className="users-panel-eyebrow">{editing ? "PERFIL DEL EQUIPO" : "GESTIÓN DEL EQUIPO"}</p>
              <h2 className="font-semibold text-primary">
                {editing ? "Administrar cuenta" : "Nuevo usuario"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                La contraseña se almacena únicamente como hash seguro.
              </p>
            </div>
            {editing && (
              <button
                className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-subtle"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancelar
              </button>
            )}
          </div>
          <TextField
            defaultValue={editing?.name}
            label="Nombre"
            name="name"
            required
          />
          <TextField
            defaultValue={editing?.email}
            label="Correo electrónico"
            name="email"
            required
            type="email"
          />
          <TextField
            label={editing ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
            name="password"
            required={!editing}
            type="password"
          />
          {!editing || editing.id !== currentUser?.id ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-primary">Rol</span>
                <select
                  className={inputClass}
                  defaultValue={editing?.role ?? "RECEPTIONIST"}
                  name="role"
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 text-sm text-primary">
                <input
                  defaultChecked={editing?.isActive ?? true}
                  name="isActive"
                  type="checkbox"
                />
                Cuenta activa
              </label>
            </>
          ) : (
            <p className="rounded-xl bg-subtle px-3 py-3 text-xs leading-5 text-muted">
              No puedes cambiar tu propio rol ni desactivar tu cuenta desde esta
              pantalla.
            </p>
          )}
          <p className="users-password-hint text-xs leading-5 text-muted">
            Usa una contraseña de 12 a 72 bytes UTF-8. Al restablecerla se
            cerrarán las sesiones existentes de esa cuenta.
          </p>
          <button
            className="w-full rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? "Guardando..." : "Guardar usuario"}
          </button>
        </form>
      </div>
    </section>
  );
}

function TextField({
  label,
  name,
  required = false,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input
        autoComplete={name === "password" ? "new-password" : undefined}
        className={inputClass}
        defaultValue={defaultValue}
        maxLength={type === "email" ? 191 : type === "password" ? 72 : undefined}
        minLength={type === "password" ? 12 : undefined}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function getRequestError(error: unknown): string {
  if (
    isAxiosError<{ error?: string; details?: Array<{ message: string }> }>(error)
  ) {
    const message = error.response?.data?.error;
    if (typeof message === "string") {
      const detail = error.response?.data?.details?.[0]?.message;
      return detail ? `${message} ${detail}` : message;
    }
  }
  return "No se pudo completar la solicitud. Comprueba tu conexión e inténtalo de nuevo.";
}

function parseRole(value: FormDataEntryValue | null): UserRole | undefined {
  switch (value) {
    case "ADMIN":
    case "VETERINARIAN":
    case "RECEPTIONIST":
      return value;
    default:
      return undefined;
  }
}
