import { lazy, Suspense, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth, type UserRole } from "../auth/AuthContext";
import { BrandLogo, LoadingScreen, ServiceUnavailable } from "../auth/LoginPage";
import LoginPage from "../auth/LoginPage";
import AppointmentsPage from "../features/appointments/AppointmentsPage";
import ClinicPage, { type ClinicSection } from "../features/clinic/ClinicPage";
import { api } from "../lib/api";
import { ThemeToggle } from "../theme/ThemeContext";

const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const DocumentsPage = lazy(() => import("../features/documents/DocumentsPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));

const navigation: Array<{
  label: string;
  to: string;
  clinical: ClinicSection | null;
  roles?: UserRole[];
  description?: string;
  icon: string;
}> = [
  { label: "Inicio", to: "/", clinical: null, icon: "home" },
  { label: "Agenda", to: "/appointments", clinical: null, icon: "calendar" },
  { label: "Propietarios", to: "/owners", clinical: "owners", icon: "users" },
  { label: "Mascotas", to: "/pets", clinical: "pets", icon: "paw" },
  { label: "Consultas", to: "/consultations", clinical: "consultations", icon: "clipboard" },
  { label: "Vacunas", to: "/vaccines", clinical: "vaccines", icon: "shield" },
  { label: "Tratamientos", to: "/treatments", clinical: "treatments", icon: "heart" },
  {
    label: "Reportes",
    to: "/reports",
    clinical: null,
    description: "Indicadores y actividad de la clínica por periodo.",
    icon: "chart",
  },
  {
    label: "Documentos",
    to: "/documents",
    clinical: null,
    description: "Vista previa de responsivas y autorizaciones de la clínica.",
    icon: "document",
  },
  {
    label: "Usuarios",
    to: "/users",
    clinical: null,
    roles: ["ADMIN", "VETERINARIAN"],
    description: "Cuentas, roles y acceso del equipo.",
    icon: "settings",
  },
];

function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const canReadClinical = user?.role === "ADMIN" || user?.role === "VETERINARIAN";
  const visibleNavigation = navigation.filter(
    (item) =>
      (!item.roles || (user && item.roles.includes(user.role))) &&
      (!item.clinical ||
        canReadClinical ||
        ["owners", "pets"].includes(item.clinical)),
  );

  async function handleLogout() {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      setLoggingOut(false);
    }
  }

  return (
    <div className={`workspace${collapsed ? " workspace--collapsed" : ""}`}>
      {mobileOpen && (
        <button
          aria-label="Cerrar menú"
          className="workspace-scrim"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside className={`workspace-sidebar${mobileOpen ? " is-open" : ""}`}>
        <div className="workspace-brand-row">
          <Link
            aria-label="Inicio - Clínica Veterinaria Ayala"
            className="workspace-brand"
            onClick={() => setMobileOpen(false)}
            to="/"
          >
            <BrandLogo compact />
          </Link>
          <button
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="workspace-collapse"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            type="button"
          >
            <ModuleIcon name={collapsed ? "expand" : "collapse"} />
          </button>
        </div>
        <p className="workspace-nav-caption">MENÚ PRINCIPAL</p>
        <nav aria-label="Navegación principal" className="workspace-nav">
          {visibleNavigation.map((item) => (
            <NavLink
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `workspace-nav-link${isActive ? " is-active" : ""}`
              }
              end={item.to === "/"}
              key={item.to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              to={item.to}
            >
              <ModuleIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-sidebar-actions">
            <ThemeToggle className="workspace-theme-toggle" />
            <button
              aria-label={collapsed ? "Cerrar sesión" : undefined}
              className="workspace-logout"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              title={collapsed ? "Cerrar sesión" : undefined}
              type="button"
            >
              <ModuleIcon name="logout" />
              <span>{loggingOut ? "Cerrando..." : "Cerrar sesión"}</span>
            </button>
          </div>
          <div className="workspace-user">
            <span className="workspace-avatar" aria-hidden="true">
              {user?.name?.trim().charAt(0).toUpperCase() ?? "U"}
            </span>
            <span className="workspace-user-copy">
              <strong>{user?.name}</strong>
              <small>{roleLabel(user?.role)}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-mobile-header">
          <Link aria-label="Inicio - Clínica Veterinaria Ayala" to="/">
            <BrandLogo compact />
          </Link>
          <button
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            className="workspace-mobile-menu-button"
            onClick={() => setMobileOpen((value) => !value)}
            type="button"
          >
            <ModuleIcon name={mobileOpen ? "close" : "menu"} />
          </button>
        </header>
        <main className="workspace-content">
          {logoutError && (
            <p className="workspace-alert" role="alert">
              {logoutError}
            </p>
          )}
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>Clínica Veterinaria Ayala</span>
          <span>Sistema de gestión · Acceso autorizado únicamente</span>
        </footer>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const canReadClinical = user?.role === "ADMIN" || user?.role === "VETERINARIAN";
  const cards = navigation.filter(
    (item) =>
      (!item.roles || (user && item.roles.includes(user.role))) &&
      (["/appointments", "/reports", "/documents", "/users"].includes(item.to) ||
        (item.clinical &&
          (canReadClinical || ["owners", "pets"].includes(item.clinical)))),
  );
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const todayKey = localDateKey(today);

    async function loadDashboard() {
      try {
        const [petsResponse, ownersResponse, appointmentsResponse] =
          await Promise.all([
            api.get<ListResponse<unknown>>("/pets", { params: { limit: 1 } }),
            api.get<ListResponse<unknown>>("/owners", { params: { limit: 1 } }),
            api.get<{ data: DashboardAppointment[] }>("/appointments", {
              params: { from: today.toISOString(), to: nextWeek.toISOString() },
            }),
          ]);

        const clinicalResponses = canReadClinical
          ? await Promise.all([
              api.get<ListResponse<DashboardConsultation>>(
                "/clinical/consultations",
                { params: { page: 1, limit: 4 } },
              ),
              api.get<ListResponse<unknown>>("/clinical/vaccines", {
                params: { page: 1, limit: 1 },
              }),
              api.get<ListResponse<unknown>>("/clinical/treatments", {
                params: { page: 1, limit: 1 },
              }),
            ])
          : null;

        if (!active) return;
        const appointments = appointmentsResponse.data.data.filter(
          (appointment) => appointment.status !== "CANCELLED",
        );
        setDashboard({
          petTotal: petsResponse.data.total,
          ownerTotal: ownersResponse.data.total,
          todayAppointmentTotal: appointments.filter(
            (appointment) =>
              localDateKey(new Date(appointment.startsAt)) === todayKey &&
              ["SCHEDULED", "CONFIRMED"].includes(appointment.status),
          ).length,
          nextAppointments: appointments
            .filter((appointment) => new Date(appointment.startsAt) >= now)
            .slice(0, 4),
          consultationTotal: clinicalResponses?.[0].data.total,
          recentConsultations: clinicalResponses?.[0].data.data ?? [],
          vaccineTotal: clinicalResponses?.[1].data.total,
          treatmentTotal: clinicalResponses?.[2].data.total,
        });
      } catch {
        if (active) {
          setDashboardError(
            "No se pudo cargar el resumen de la clínica. Comprueba tu conexión e inténtalo de nuevo más tarde.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [canReadClinical]);

  const currentDate = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const metrics = [
    {
      title: "Mascotas",
      value: dashboard?.petTotal,
      note: "Pacientes registrados",
      icon: "paw",
      tone: "blue",
      to: "/pets",
    },
    {
      title: "Propietarios",
      value: dashboard?.ownerTotal,
      note: "Contactos registrados",
      icon: "users",
      tone: "green",
      to: "/owners",
    },
    {
      title: "Citas para hoy",
      value: dashboard?.todayAppointmentTotal,
      note: "Pendientes o confirmadas",
      icon: "calendar",
      tone: "amber",
      to: "/appointments",
    },
    ...(canReadClinical
      ? [
          {
            title: "Consultas",
            value: dashboard?.consultationTotal,
            note: "Registros clínicos",
            icon: "clipboard",
            tone: "violet",
            to: "/consultations",
          },
          {
            title: "Vacunas",
            value: dashboard?.vaccineTotal,
            note: "Aplicaciones registradas",
            icon: "shield",
            tone: "green",
            to: "/vaccines",
          },
          {
            title: "Tratamientos",
            value: dashboard?.treatmentTotal,
            note: "Tratamientos registrados",
            icon: "heart",
            tone: "rose",
            to: "/treatments",
          },
        ]
      : []),
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-date">
            <ModuleIcon name="calendar" />
            {currentDate}
          </p>
          <p className="dashboard-eyebrow">CLÍNICA VETERINARIA AYALA</p>
          <h1>
            {greeting}, {user?.name?.split(" ")[0] ?? "equipo"}
          </h1>
          <p className="dashboard-hero-description">
            {user?.role === "RECEPTIONIST"
              ? "Todo listo para brindar una atención cercana a cada paciente."
              : "Tu espacio de trabajo para cuidar cada detalle de la salud de nuestros pacientes."}
          </p>
          <Link className="dashboard-primary-link" to="/appointments">
            <ModuleIcon name="calendar" />
            Ver agenda de hoy
            <ModuleIcon name="arrow" />
          </Link>
        </div>
        <div aria-hidden="true" className="dashboard-hero-art">
          <span className="dashboard-hero-orbit dashboard-hero-orbit--one" />
          <span className="dashboard-hero-orbit dashboard-hero-orbit--two" />
          <span className="dashboard-hero-pet" />
          <span className="dashboard-hero-tag">
            <ModuleIcon name="heart" />
            Cuidamos de ellos
          </span>
        </div>
      </section>

      {dashboardError && (
        <p className="workspace-alert" role="alert">
          {dashboardError}
        </p>
      )}

      <section aria-label="Indicadores de la clínica" className="dashboard-metrics">
        {metrics.map((metric, index) => (
          <Link
            className={`dashboard-metric dashboard-metric--${metric.tone}`}
            key={metric.title}
            style={{ animationDelay: `${index * 55}ms` }}
            to={metric.to}
          >
            <span className="dashboard-metric-icon">
              <ModuleIcon name={metric.icon} />
            </span>
            <span className="dashboard-metric-copy">
              <span className="dashboard-metric-title">{metric.title}</span>
              <strong>{loading ? "—" : metric.value ?? "—"}</strong>
              <small>{metric.note}</small>
            </span>
            <ModuleIcon name="arrow" />
          </Link>
        ))}
      </section>

      <section className="dashboard-lower-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-eyebrow">ORGANIZA TU DÍA</p>
              <h2>Próximas citas</h2>
            </div>
            <Link className="dashboard-text-link" to="/appointments">
              Ver agenda <ModuleIcon name="arrow" />
            </Link>
          </div>
          {loading ? (
            <DashboardLoading />
          ) : dashboardError ? (
            <DashboardEmpty message="No se pudieron consultar las citas." />
          ) : dashboard?.nextAppointments.length ? (
            <div className="dashboard-list">
              {dashboard.nextAppointments.map((appointment) => (
                <div className="dashboard-appointment" key={appointment.id}>
                  <span className="dashboard-appointment-time">
                    <small>
                      {new Intl.DateTimeFormat("es-MX", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(appointment.startsAt))}
                    </small>
                    <strong>
                      {new Intl.DateTimeFormat("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(appointment.startsAt))}
                    </strong>
                  </span>
                  <span className="dashboard-appointment-copy">
                    <strong>{appointment.pet?.name ?? "Paciente por asignar"}</strong>
                    <small>
                      {appointment.owner.firstName} {appointment.owner.lastName}
                      {" · "}{appointment.reason}
                    </small>
                  </span>
                  <span className={`dashboard-status dashboard-status--${appointment.status.toLowerCase()}`}>
                    {appointmentStatusLabel(appointment.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <DashboardEmpty message="No hay próximas citas registradas." />
          )}
        </div>

        {canReadClinical ? (
          <div className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="dashboard-panel-eyebrow">SEGUIMIENTO CLÍNICO</p>
                <h2>Actividad reciente</h2>
              </div>
              <Link className="dashboard-text-link" to="/consultations">
                Consultas <ModuleIcon name="arrow" />
              </Link>
            </div>
            {loading ? (
              <DashboardLoading />
            ) : dashboardError ? (
              <DashboardEmpty message="No se pudo consultar la actividad clínica." />
            ) : dashboard?.recentConsultations.length ? (
              <div className="dashboard-list">
                {dashboard.recentConsultations.map((consultation) => (
                  <div className="dashboard-activity" key={consultation.id}>
                    <span className="dashboard-activity-icon">
                      <ModuleIcon name="clipboard" />
                    </span>
                    <span className="dashboard-activity-copy">
                      <strong>{consultation.pet.name}</strong>
                      <small>
                        {consultation.reason ||
                          consultation.diagnosis ||
                          "Consulta registrada"}
                      </small>
                    </span>
                    <time>
                      {new Intl.DateTimeFormat("es-MX", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(consultation.occurredAt))}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <DashboardEmpty message="Aún no hay consultas registradas." />
            )}
          </div>
        ) : (
          <div className="dashboard-panel dashboard-quick-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="dashboard-panel-eyebrow">ACCESO RÁPIDO</p>
                <h2>¿Qué necesitas hacer?</h2>
              </div>
            </div>
            <div className="dashboard-quick-links">
              {cards.slice(0, 4).map((item) => (
                <Link key={item.to} to={item.to}>
                  <ModuleIcon name={item.icon} />
                  <span>{item.label}</span>
                  <ModuleIcon name="arrow" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-module-section">
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-panel-eyebrow">TU ESPACIO DE TRABAJO</p>
            <h2>Acceso a módulos</h2>
          </div>
        </div>
        <div className="dashboard-module-grid">
          {cards.map((item) => (
            <Link className="dashboard-module-card" key={item.to} to={item.to}>
              <span className="dashboard-module-icon">
                <ModuleIcon name={item.icon} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>
                  {item.description ??
                    (item.to === "/appointments"
                      ? "Programación y seguimiento de citas."
                      : cardDescription(item.clinical))}
                </small>
              </span>
              <ModuleIcon name="arrow" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

interface DashboardAppointment {
  id: string;
  startsAt: string;
  reason: string;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  owner: { firstName: string; lastName: string };
  pet: { name: string } | null;
}

interface DashboardConsultation {
  id: string;
  occurredAt: string;
  reason: string;
  diagnosis: string | null;
  pet: { name: string };
}

interface DashboardData {
  petTotal: number;
  ownerTotal: number;
  todayAppointmentTotal: number;
  nextAppointments: DashboardAppointment[];
  consultationTotal?: number;
  recentConsultations: DashboardConsultation[];
  vaccineTotal?: number;
  treatmentTotal?: number;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function appointmentStatusLabel(status: DashboardAppointment["status"]): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirmada";
    case "COMPLETED":
      return "Completada";
    case "NO_SHOW":
      return "No asistió";
    case "CANCELLED":
      return "Cancelada";
    default:
      return "Programada";
  }
}

function DashboardLoading() {
  return (
    <div aria-label="Cargando información" className="dashboard-loading">
      <span />
      <span />
      <span />
    </div>
  );
}

function DashboardEmpty({ message }: { message: string }) {
  return (
    <div className="dashboard-empty">
      <span>
        <ModuleIcon name="calendar" />
      </span>
      <p>{message}</p>
    </div>
  );
}

function ModuleIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    calendar: "M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h3m3-4h3",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21",
    clipboard: "M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 3h6v4H9zM8 12h8m-8 4h8",
    shield: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8ZM8 12h2l1.5-3 2 6 1.5-3H17",
    chart: "M4 19V5m0 14h17M8 15l4-4 3 2 6-7",
    document: "M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v5h5m-9 5h5m-5 4h5",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
    logout: "M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6",
    collapse: "m15 18-6-6 6-6",
    expand: "m9 18 6-6-6-6",
    arrow: "M4 12h15m-6-6 6 6-6 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M18 6 6 18",
    paw: "M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-11-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm14 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-7 3c-2.6 0-5 2.4-5 4.5a2 2 0 0 0 2.7 1.9c1.5-.6 3.1-.6 4.6 0A2 2 0 0 0 17 15.5c0-2.1-2.4-4.5-5-4.5Z",
  };
  const filled = name === "paw";
  return (
    <svg
      aria-hidden="true"
      className="module-icon"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d={paths[name] ?? paths.document} />
    </svg>
  );
}

function RequireAuth() {
  const { status } = useAuth();
  if (status === "checking") {
    return <LoadingScreen message="Verificando la sesión segura..." />;
  }
  if (status === "unavailable") return <ServiceUnavailable />;
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <WorkspaceLayout />;
}

function RoleGuard({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (user?.role === "RECEPTIONIST") return <Navigate to="/" replace />;
  return children;
}

function roleLabel(role: string | undefined): string {
  switch (role) {
    case "ADMIN":
      return "Administración";
    case "VETERINARIAN":
      return "Veterinario/a";
    case "RECEPTIONIST":
      return "Recepción";
    default:
      return "Personal de la clínica";
  }
}

function cardDescription(section: ClinicSection | null): string {
  switch (section) {
    case "owners":
      return "Datos de contacto y mascotas asociadas.";
    case "pets":
      return "Identificación y datos de cada paciente.";
    case "consultations":
      return "Motivos, diagnóstico y notas de consulta.";
    case "vaccines":
      return "Aplicaciones y seguimiento de próximas dosis.";
    case "treatments":
      return "Indicaciones y fechas de tratamiento.";
    default:
      return "";
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/owners" element={<ClinicPage section="owners" />} />
          <Route path="/pets" element={<ClinicPage section="pets" />} />
          <Route
            path="/reports"
            element={
              <Suspense fallback={<LoadingScreen message="Cargando reportes..." />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="/documents"
            element={
              <Suspense fallback={<LoadingScreen message="Cargando documentos..." />}>
                <DocumentsPage />
              </Suspense>
            }
          />
          <Route
            path="/consultations"
            element={
              <RoleGuard>
                <ClinicPage section="consultations" />
              </RoleGuard>
            }
          />
          <Route
            path="/vaccines"
            element={
              <RoleGuard>
                <ClinicPage section="vaccines" />
              </RoleGuard>
            }
          />
          <Route
            path="/treatments"
            element={
              <RoleGuard>
                <ClinicPage section="treatments" />
              </RoleGuard>
            }
          />
          <Route
            path="/users"
            element={
              <RoleGuard>
                <Suspense fallback={<LoadingScreen message="Cargando usuarios..." />}>
                  <UsersPage />
                </Suspense>
              </RoleGuard>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-subtle px-6 text-center text-primary">
      <div>
        <p className="text-sm font-semibold text-danger">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary">
          Página no encontrada
        </h1>
        <Link className="mt-4 inline-block text-sm font-semibold text-accent" to="/">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
