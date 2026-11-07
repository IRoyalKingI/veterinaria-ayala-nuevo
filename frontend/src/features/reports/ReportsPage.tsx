import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
type ShiftFilter = "ALL" | "MORNING" | "AFTERNOON";
type ReportType =
  | "GENERAL"
  | "CONSULTATIONS"
  | "VACCINES"
  | "APPOINTMENTS"
  | "SPECIES"
  | "SHIFTS";

interface ShiftActivity {
  appointments: number;
  consultations: number;
  vaccines: number;
  treatments: number;
}

interface ReportSummary {
  general: {
    owners: number;
    pets: number;
    speciesDistribution: Array<{
      species: string;
      total: number;
      percentage: number;
    }>;
  };
  period: {
    appointments: {
      total: number;
      byStatus: Record<AppointmentStatus, number>;
    };
    consultations: number;
    vaccines: number;
    treatments: number;
    activityByShift: {
      MORNING: ShiftActivity;
      AFTERNOON: ShiftActivity;
      UNSPECIFIED: ShiftActivity;
    };
  };
}

interface Filters {
  from: string;
  to: string;
  shift: ShiftFilter;
  type: ReportType;
}

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Programadas",
  CONFIRMED: "Confirmadas",
  COMPLETED: "Atendidas",
  CANCELLED: "Canceladas",
  NO_SHOW: "Inasistencias",
};

const appointmentStatuses: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const shiftLabels: Record<ShiftFilter, string> = {
  ALL: "Todos los turnos",
  MORNING: "Matutino",
  AFTERNOON: "Vespertino",
};

const reportLabels: Record<ReportType, string> = {
  GENERAL: "Resumen general",
  CONSULTATIONS: "Consultas",
  VACCINES: "Vacunación",
  APPOINTMENTS: "Citas",
  SPECIES: "Mascotas por especie",
  SHIFTS: "Actividad por turno",
};

const shiftRows: Array<{
  key: keyof ReportSummary["period"]["activityByShift"];
  label: string;
}> = [
  { key: "MORNING", label: "Matutino" },
  { key: "AFTERNOON", label: "Vespertino" },
  { key: "UNSPECIFIED", label: "No especificado" },
];

function localDateInput(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function initialFilters(): Filters {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: localDateInput(from),
    to: localDateInput(to),
    shift: "ALL",
    type: "GENERAL",
  };
}

export default function ReportsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSummary(null);

    api
      .get<{ data: ReportSummary }>("/reports/summary", {
        params: {
          from: filters.from,
          to: filters.to,
          shift: filters.shift,
        },
      })
      .then(({ data }) => {
        if (active) setSummary(data.data);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getRequestError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!draft.from || !draft.to) {
      setError("Selecciona ambas fechas para generar el informe.");
      return;
    }
    if (draft.from > draft.to) {
      setError("La fecha inicial debe ser anterior o igual a la fecha final.");
      return;
    }
    setFilters(draft);
  }

  const showReport = (type: ReportType) =>
    filters.type === "GENERAL" || filters.type === type;

  return (
    <section className="reports-page space-y-6 print-report">
      <div className="reports-heading no-print">
        <div className="reports-heading-copy">
          <span className="reports-heading-icon" aria-hidden="true">
            <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
              <path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-6" />
              <path d="M16 7h3v3" />
            </svg>
          </span>
          <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Indicadores de la clínica
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
            Informes y Reportes Clínicos
          </h1>
          <p className="mt-2 text-sm text-muted">
            Generación de resúmenes operativos y asistenciales a partir de los registros.
          </p>
          </div>
        </div>
        <button
          className="reports-print-button no-print rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!summary || loading}
          onClick={() => window.print()}
          type="button"
        >
          Imprimir Reporte
        </button>
      </div>

      <div className="hidden print-only">
        <div className="flex items-center gap-4 border-b border-line pb-4">
          <img
            alt="Logo Clínica Veterinaria Ayala"
            className="h-16 w-16 object-contain"
            src="/images/logo-clinica-ayala.png"
          />
          <div>
            <p className="text-lg font-bold text-primary">Clínica Veterinaria Ayala</p>
            <h2 className="font-semibold">{reportLabels[filters.type]}</h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          Periodo: {formatRange(filters.from, filters.to)} · Turno: {shiftLabels[filters.shift]}
        </p>
        <p className="mt-1 text-xs text-muted">
          Elaborado: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(new Date())}
        </p>
      </div>

      <form
        className="reports-filters no-print grid gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:items-end"
        onSubmit={handleSubmit}
      >
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-primary">Tipo de informe</span>
          <select
            className={inputClass}
            onChange={(event) =>
              setDraft((current) => ({ ...current, type: event.target.value as ReportType }))
            }
            value={draft.type}
          >
            {Object.entries(reportLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-primary">Desde</span>
          <input
            className={inputClass}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            required
            type="date"
            value={draft.from}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-primary">Hasta</span>
          <input
            className={inputClass}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            required
            type="date"
            value={draft.to}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-primary">Turno</span>
          <select
            className={inputClass}
            onChange={(event) =>
              setDraft((current) => ({ ...current, shift: event.target.value as ShiftFilter }))
            }
            value={draft.shift}
          >
            {Object.entries(shiftLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button
          className="rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50] focus:outline-none focus:ring-4 focus:ring-blue-200"
          type="submit"
        >
          Generar Informe
        </button>
      </form>

      {error && (
        <p className="no-print rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p aria-live="polite" className="reports-loading rounded-2xl border border-line bg-surface-raised p-8 text-center text-sm text-muted">
          Calculando reportes...
        </p>
      ) : summary ? (
        <>
          <section aria-label="Totales generales" className="reports-metrics reports-metrics--general grid gap-4 sm:grid-cols-2">
            <MetricCard label="Propietarios registrados · total histórico" value={summary.general.owners} />
            <MetricCard label="Mascotas registradas · total histórico" value={summary.general.pets} />
          </section>

          {(showReport("CONSULTATIONS") || showReport("VACCINES") || showReport("APPOINTMENTS")) && (
            <section className="reports-activity-section space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">Actividad del periodo</h2>
                <p className="mt-1 text-sm text-muted">
                  {formatRange(filters.from, filters.to)} · {shiftLabels[filters.shift]}
                </p>
              </div>
              <div className="reports-metrics grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {showReport("APPOINTMENTS") && (
                  <MetricCard label="Citas" value={summary.period.appointments.total} />
                )}
                {showReport("CONSULTATIONS") && (
                  <MetricCard label="Consultas" value={summary.period.consultations} />
                )}
                {showReport("VACCINES") && (
                  <MetricCard label="Vacunas aplicadas" value={summary.period.vaccines} />
                )}
                {filters.type === "GENERAL" && (
                  <MetricCard label="Tratamientos iniciados" value={summary.period.treatments} />
                )}
              </div>
            </section>
          )}

          {showReport("SPECIES") && (
            <section className="reports-data-panel overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-semibold text-primary">Distribución de Pacientes por Especie</h2>
                <p className="mt-1 text-xs text-muted">
                  Padrón completo registrado; no se filtra por periodo ni turno.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="reports-table w-full text-left text-sm">
                  <thead className="bg-subtle text-xs uppercase text-muted">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Especie</th>
                      <th className="px-5 py-3 font-semibold">Pacientes</th>
                      <th className="px-5 py-3 font-semibold">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {summary.general.speciesDistribution.map((item) => (
                      <tr key={item.species}>
                        <td className="px-5 py-3 text-primary">{item.species}</td>
                        <td className="px-5 py-3 font-semibold text-primary">{item.total}</td>
                        <td className="px-5 py-3 text-muted">{item.percentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {summary.general.speciesDistribution.length === 0 && (
                      <tr><td className="px-5 py-4 text-muted" colSpan={3}>No hay mascotas registradas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {showReport("APPOINTMENTS") && (
            <section className="reports-data-panel overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-semibold text-primary">Balance de Citas en el Periodo</h2>
                <p className="mt-1 text-xs text-muted">
                  Conteo por fecha de inicio de cita, sin duplicar registros.
                </p>
              </div>
              <div className="divide-y divide-line">
                {appointmentStatuses.map((status) => (
                  <div className="flex items-center justify-between px-5 py-3 text-sm" key={status}>
                    <span className="text-muted">{statusLabels[status]}</span>
                    <span className="font-semibold text-primary">
                      {summary.period.appointments.byStatus[status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(showReport("SHIFTS") || filters.type === "GENERAL") && (
            <section className="reports-data-panel overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="font-semibold text-primary">Actividad registrada por turno</h2>
                <p className="mt-1 text-xs text-muted">
                  Periodo {formatRange(filters.from, filters.to)}. Este desglose muestra todos los turnos,
                  incluido el turno no especificado; las tarjetas anteriores sí respetan el filtro elegido.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="reports-table w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-subtle text-xs uppercase text-muted">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Turno</th>
                      <th className="px-5 py-3 font-semibold">Citas</th>
                      <th className="px-5 py-3 font-semibold">Consultas</th>
                      <th className="px-5 py-3 font-semibold">Vacunas</th>
                      <th className="px-5 py-3 font-semibold">Tratamientos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shiftRows.map(({ key, label }) => (
                      <tr key={key}>
                        <td className="px-5 py-3 font-medium text-primary">{label}</td>
                        <td className="px-5 py-3 text-muted">{summary.period.activityByShift[key].appointments}</td>
                        <td className="px-5 py-3 text-muted">{summary.period.activityByShift[key].consultations}</td>
                        <td className="px-5 py-3 text-muted">{summary.period.activityByShift[key].vaccines}</td>
                        <td className="px-5 py-3 text-muted">{summary.period.activityByShift[key].treatments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : (
        !error && (
          <p className="rounded-2xl border border-line bg-surface-raised p-8 text-center text-sm text-muted">
            No hay datos para mostrar.
          </p>
        )
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  const iconPath = label.toLowerCase().includes("mascota")
    ? "M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm14 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-7 3c-2.7 0-5 2.4-5 4.5a2 2 0 0 0 2.7 1.9c1.5-.6 3.1-.6 4.6 0A2 2 0 0 0 17 15.5c0-2.1-2.3-4.5-5-4.5Z"
    : label.toLowerCase().includes("propietario")
      ? "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21"
      : label.toLowerCase().includes("cita")
        ? "M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h3"
        : label.toLowerCase().includes("vacuna")
          ? "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3.5-11 2.3 2.3 4.7-4.7"
          : label.toLowerCase().includes("tratamiento")
            ? "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
            : "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5H8Zm7 0v5h5m-12 4h8m-8 4h8";
  return (
    <article className="report-metric-card rounded-2xl border border-line bg-surface-raised p-5 shadow-card">
      <span className="report-metric-icon" aria-hidden="true">
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
          <path d={iconPath} />
        </svg>
      </span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-primary">
          {new Intl.NumberFormat("es-MX").format(value)}
        </p>
      </div>
    </article>
  );
}

function formatRange(from: string, to: string): string {
  const formatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });
  return `${formatter.format(new Date(`${from}T12:00:00`))} – ${formatter.format(
    new Date(`${to}T12:00:00`),
  )}`;
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
  return "No se pudo cargar el reporte. Comprueba tu conexión e inténtalo de nuevo.";
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";
