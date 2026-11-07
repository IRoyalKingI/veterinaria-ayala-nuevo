import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";

interface Owner {
  id: string;
  firstName: string;
  lastName: string;
}

interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
}

interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  shift: "MORNING" | "AFTERNOON" | null;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes?: string | null;
  owner: { id: string; firstName: string; lastName: string; phone: string };
  pet: { id: string; name: string; species: string } | null;
  veterinarian?: { id: string; name: string } | null;
}

interface ListResult<T> {
  data: T[];
}

const statusLabels: Record<Appointment["status"], string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(localDateInput(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const from = new Date(`${selectedDate}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    void Promise.all([
      api.get<ListResult<Appointment>>("/appointments", {
        params: { from: from.toISOString(), to: to.toISOString() },
      }),
      api.get<ListResult<Owner>>("/owners", { params: { limit: 100 } }),
      api.get<ListResult<Pet>>("/pets", { params: { limit: 100 } }),
    ])
      .then(([appointmentResponse, ownerResponse, petResponse]) => {
        if (!active) return;
        setAppointments(appointmentResponse.data.data);
        setOwners(ownerResponse.data.data);
        setPets(petResponse.data.data);
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
  }, [selectedDate, refreshKey]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startsAt = new Date(String(formData.get("startsAt")));
    const endsAt = new Date(String(formData.get("endsAt")));

    try {
      await api.post("/appointments", {
        ownerId: String(formData.get("ownerId")),
        petId: String(formData.get("petId") || "") || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: String(formData.get("reason") ?? "").trim(),
        shift: String(formData.get("shift") ?? "") || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
      });
      setNotice("La cita se registró correctamente.");
      setRefreshKey((key) => key + 1);
      form.reset();
      setOwnerId("");
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: Appointment["status"]) {
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      setNotice("El estado de la cita se actualizó.");
      setRefreshKey((key) => key + 1);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    }
  }

  const availablePets = pets.filter((pet) => pet.ownerId === ownerId);

  return (
    <section className="appointments-page">
      <div className="appointments-heading">
        <div className="appointments-title">
          <span className="appointments-title-icon"><AppointmentIcon name="calendar" /></span>
          <div>
          <p className="appointments-eyebrow">ORGANIZACIÓN DE LA CLÍNICA</p>
          <h1>Agenda</h1>
          <p>Citas, horarios y seguimiento de atención.</p>
          </div>
        </div>
        <div className="appointments-date-tools">
          <button
          className="appointments-today-button"
          onClick={() => setSelectedDate(localDateInput(new Date()))}
          type="button"
          >
          Hoy
          </button>
          <label>
          <span>Fecha de agenda</span>
          <input
            className={inputClass}
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
          </label>
        </div>
      </div>

      {(error || notice) && (
        <p className={`appointments-notice ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
          {error ?? notice}
        </p>
      )}

      <div className="appointments-layout">
        <section className="appointments-list-panel">
          <div className="appointments-list-heading">
          <div>
            <p className="appointments-panel-eyebrow">VISTA DIARIA</p>
            <h2>Citas del día</h2>
            <p>{loading ? "Cargando agenda..." : `${appointments.length} ${appointments.length === 1 ? "cita" : "citas"}`}</p>
          </div>
          <span className="appointments-list-date">
            <AppointmentIcon name="calendar" />
            {new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${selectedDate}T00:00:00`))}
          </span>
          </div>
          {loading ? (
          <div aria-live="polite" className="appointments-loading">
            <span /><span /><span />
          </div>
          ) : appointments.length === 0 ? (
          <div className="appointments-empty">
            <span><AppointmentIcon name="calendar" /></span>
            <h3>Tu agenda está despejada</h3>
            <p>No hay citas registradas para este día. Puedes programar una nueva desde el formulario.</p>
          </div>
          ) : (
          <div className="appointments-list">
            {appointments.map((appointment) => (
              <AppointmentRow appointment={appointment} key={appointment.id} onStatusChange={updateStatus} />
            ))}
          </div>
          )}
        </section>

        <form className="appointment-form" key={selectedDate} onSubmit={(event) => void handleCreate(event)}>
          <div className="appointment-form-heading">
          <span><AppointmentIcon name="plus" /></span>
          <div>
            <p className="appointments-panel-eyebrow">PROGRAMACIÓN</p>
            <h2>Nueva cita</h2>
            <p>Asigna un horario y un responsable registrado.</p>
          </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-primary">Propietario</span>
            <select className={inputClass} name="ownerId" onChange={(event) => setOwnerId(event.target.value)} required value={ownerId}>
              <option value="">Selecciona propietario</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-primary">Mascota <span className="text-muted">(opcional)</span></span>
            <select className={inputClass} name="petId" disabled={!ownerId}>
              <option value="">Sin paciente asignado</option>
              {availablePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>)}
            </select>
          </label>
          <TextField defaultValue={`${selectedDate}T09:00`} label="Inicio" name="startsAt" required type="datetime-local" />
          <TextField defaultValue={`${selectedDate}T10:00`} label="Término" name="endsAt" required type="datetime-local" />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-primary">Turno (opcional)</span>
            <select className={inputClass} name="shift" defaultValue="">
              <option value="">No especificado</option>
              <option value="MORNING">Matutino</option>
              <option value="AFTERNOON">Vespertino</option>
            </select>
          </label>
          <TextField label="Motivo" name="reason" required />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-primary">Notas</span>
            <textarea className={`${inputClass} min-h-20 resize-y`} maxLength={5000} name="notes" rows={3} />
          </label>
          <button className="appointment-submit" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Registrar cita"}
            {!saving && <AppointmentIcon name="arrow" />}
          </button>
        </form>
      </div>
    </section>
  );
}

function AppointmentRow({
  appointment,
  onStatusChange,
}: {
  appointment: Appointment;
  onStatusChange: (id: string, status: Appointment["status"]) => Promise<void>;
}) {
  const isOpen = appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED";
  return (
    <article className={`appointment-card appointment-card--${appointment.status.toLowerCase()}`}>
      <div className="appointment-card-main">
        <div className="appointment-time-block">
          <time dateTime={appointment.startsAt}>
            {formatTime(appointment.startsAt)}
          </time>
          <span>{formatTime(appointment.endsAt)}</span>
          <i />
          <small>{new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(appointment.startsAt))}</small>
        </div>
        <div className="appointment-card-copy">
          <div className="appointment-card-title-row">
            <h3>{appointment.reason}</h3>
            <span className={`appointment-status appointment-status--${appointment.status.toLowerCase()}`}>
              <i />
              {statusLabels[appointment.status]}
            </span>
          </div>
          <p className="appointment-person">
            <AppointmentIcon name="users" />
            {appointment.owner.firstName} {appointment.owner.lastName}
            <span>·</span>
            <a href={`tel:${appointment.owner.phone}`}>{appointment.owner.phone}</a>
          </p>
          <p className="appointment-pet">
            <AppointmentIcon name="paw" />
            {appointment.pet ? `${appointment.pet.name} · ${appointment.pet.species}` : "Sin mascota asignada"}
            {appointment.veterinarian && <><span>·</span> {appointment.veterinarian.name}</>}
          </p>
          <div className="appointment-card-meta">
            <span>
              <AppointmentIcon name="clock" />
              {appointment.shift === "MORNING" ? "Matutino" : appointment.shift === "AFTERNOON" ? "Vespertino" : "Turno no especificado"}
            </span>
            {appointment.notes && <span className="appointment-card-notes">{appointment.notes}</span>}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="appointment-actions">
          {appointment.status === "SCHEDULED" && (
            <button className="appointment-action appointment-action--confirm" onClick={() => void onStatusChange(appointment.id, "CONFIRMED")} type="button">
              <AppointmentIcon name="check" /> Confirmar
            </button>
          )}
          <button className="appointment-action" onClick={() => void onStatusChange(appointment.id, "COMPLETED")} type="button">Completar</button>
          <button className="appointment-action" onClick={() => void onStatusChange(appointment.id, "NO_SHOW")} type="button">No asistió</button>
          <button className="appointment-action appointment-action--cancel" onClick={() => void onStatusChange(appointment.id, "CANCELLED")} type="button">Cancelar</button>
        </div>
      )}
    </article>
  );
}

const inputClass = "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15";

function AppointmentIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    calendar: "M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h3",
    plus: "M12 5v14m-7-7h14",
    arrow: "M4 12h15m-6-6 6 6-6 6",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21",
    paw: "M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm14 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-7 3c-2.7 0-5 2.4-5 4.5a2 2 0 0 0 2.7 1.9c1.5-.6 3.1-.6 4.6 0A2 2 0 0 0 17 15.5c0-2.1-2.3-4.5-5-4.5Z",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-16v6l4 2",
    check: "m5 12 4 4L19 6",
  };
  return (
    <svg aria-hidden="true" className="appointment-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d={paths[name] ?? paths.calendar} />
    </svg>
  );
}

function TextField({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input className={inputClass} defaultValue={defaultValue} name={name} required={required} type={type} />
    </label>
  );
}

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getRequestError(error: unknown): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? "No se pudo completar la solicitud.";
  }
  return "No se pudo completar la solicitud.";
}