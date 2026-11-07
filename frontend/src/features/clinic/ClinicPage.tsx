import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { getVacunasPorEspecie, normalizeSpecies } from "../../constants/vacunas";
import PrescriptionComposer from "./PrescriptionComposer";

export type ClinicSection =
  | "owners"
  | "pets"
  | "consultations"
  | "vaccines"
  | "treatments";

interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address?: string | null;
  notes?: string | null;
  _count?: { pets: number };
}

interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate?: string | null;
  color?: string | null;
  weightKg?: number | string | null;
  microchip: string | null;
  photoPath?: string | null;
  medicalNotes?: string | null;
  owner?: { id: string; firstName: string; lastName: string; phone?: string };
}

interface ClinicalEntry {
  id: string;
  pet: { id: string; name: string; species: string };
  shift?: "MORNING" | "AFTERNOON" | null;
  occurredAt?: string;
  administeredAt?: string;
  startsAt?: string;
  nextDueAt?: string | null;
  endsAt?: string | null;
  reason?: string;
  diagnosis?: string | null;
  notes?: string | null;
  name?: string;
  dosage?: string | null;
  instructions?: string | null;
  batchNumber?: string | null;
  weightKg?: number | string | null;
  author?: { name: string };
  administrator?: { name: string };
  prescription?: { id: string; generatedAt: string } | null;
}

interface ListResult<T> {
  data: T[];
  total: number;
}

const sectionDetails: Record<
  ClinicSection,
  { title: string; description: string; endpoint: string }
> = {
  owners: {
    title: "Propietarios",
    description: "Contactos responsables y sus pacientes registrados.",
    endpoint: "/owners",
  },
  pets: {
    title: "Mascotas",
    description: "Pacientes y datos básicos de identificación.",
    endpoint: "/pets",
  },
  consultations: {
    title: "Consultas",
    description: "Notas clínicas de consulta asociadas a cada paciente.",
    endpoint: "/clinical/consultations",
  },
  vaccines: {
    title: "Vacunas",
    description: "Aplicaciones registradas y fechas de seguimiento.",
    endpoint: "/clinical/vaccines",
  },
  treatments: {
    title: "Tratamientos",
    description: "Indicaciones veterinarias y duración registrada.",
    endpoint: "/clinical/treatments",
  },
};

export default function ClinicPage({ section }: { section: ClinicSection }) {
  const { user } = useAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [entries, setEntries] = useState<ClinicalEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<"all" | "Perro" | "Gato">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Owner | Pet | null>(null);
  const [prescriptionConsultationId, setPrescriptionConsultationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isClinical = section === "consultations" || section === "vaccines" || section === "treatments";
  const canReadClinical = user?.role === "ADMIN" || user?.role === "VETERINARIAN";
  const activeSpecies = speciesFilter === "all" ? undefined : speciesFilter;

  const loadData = useCallback(async () => {
    if (isClinical && !canReadClinical) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const detail = sectionDetails[section];
      const listRequest = api.get<ListResult<Owner | Pet | ClinicalEntry>>(
        detail.endpoint,
        {
          params: {
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(activeSpecies ? { species: activeSpecies } : {}),
            page,
            limit: 25,
          },
        },
      );
      const [listResponse, ownerResponse, petResponse] = await Promise.all([
        listRequest,
        section === "pets" || isClinical
          ? api.get<ListResult<Owner>>("/owners", { params: { limit: 100 } })
          : Promise.resolve(null),
        isClinical
          ? api.get<ListResult<Pet>>("/pets", { params: { limit: 100 } })
          : Promise.resolve(null),
      ]);

      if (section === "owners") setOwners(listResponse.data.data as Owner[]);
      else if (section === "pets") setPets(listResponse.data.data as Pet[]);
      else setEntries(listResponse.data.data as ClinicalEntry[]);
      setTotalCount(listResponse.data.total);
      if (ownerResponse) setOwners(ownerResponse.data.data);
      if (petResponse) setPets(petResponse.data.data);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setLoading(false);
    }
  }, [section, search, page, activeSpecies, isClinical, canReadClinical, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    const value = (key: string) => String(formData.get(key) ?? "").trim();
    const optional = (key: string) => value(key) || null;
    let payload: Record<string, string | number | null>;

    if (section === "owners") {
      payload = {
        firstName: value("firstName"),
        lastName: value("lastName"),
        email: optional("email"),
        phone: value("phone"),
        address: optional("address"),
        notes: optional("notes"),
      };
    } else if (section === "pets") {
      payload = {
        ownerId: value("ownerId"),
        name: value("name"),
        species: value("species"),
        breed: optional("breed"),
        sex: value("sex"),
        birthDate: optional("birthDate"),
        color: optional("color"),
        microchip: optional("microchip"),
        ...(user?.role === "RECEPTIONIST"
          ? {}
          : {
              weightKg: optional("weightKg"),
              medicalNotes: optional("medicalNotes"),
            }),
      };
    } else if (section === "consultations") {
      payload = {
        petId: value("petId"),
        shift: optional("shift"),
        occurredAt: value("occurredAt")
          ? new Date(value("occurredAt")).toISOString()
          : new Date().toISOString(),
        reason: value("reason"),
        diagnosis: optional("diagnosis"),
        notes: optional("notes"),
        weightKg: optional("weightKg"),
      };
    } else if (section === "vaccines") {
      payload = {
        petId: value("petId"),
        name: value("name"),
        shift: optional("shift"),
        administeredAt: new Date(value("administeredAt")).toISOString(),
        nextDueAt: value("nextDueAt")
          ? new Date(value("nextDueAt")).toISOString()
          : null,
        batchNumber: optional("batchNumber"),
        notes: optional("notes"),
      };
    } else {
      payload = {
        petId: value("petId"),
        name: value("name"),
        shift: optional("shift"),
        dosage: optional("dosage"),
        instructions: optional("instructions"),
        startsAt: new Date(value("startsAt")).toISOString(),
        endsAt: value("endsAt")
          ? new Date(value("endsAt")).toISOString()
          : null,
      };
    }

    try {
      const url = sectionDetails[section].endpoint;
      if (editing && (section === "owners" || section === "pets")) {
        await api.patch(`${url}/${editing.id}`, payload);
        setNotice("Los datos se actualizaron correctamente.");
      } else {
        await api.post(url, payload);
        setNotice("El registro se guardó correctamente.");
      }
      setEditing(null);
      setRefreshKey((key) => key + 1);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (isClinical && !canReadClinical) {
    return (
      <section className="rounded-2xl border border-line bg-surface-raised p-8 text-center">
        <h1 className="text-xl font-semibold text-primary">Acceso restringido</h1>
        <p className="mt-2 text-sm text-muted">
          El expediente clínico está disponible para personal veterinario y administración.
        </p>
      </section>
    );
  }

  const title = sectionDetails[section];
  const canEdit = section === "owners" || section === "pets";
  const formTitle = editing ? "Editar registro" : `Nuevo registro de ${title.title.toLowerCase()}`;
  const isDirectory = section === "owners" || section === "pets";
  const isConsultations = section === "consultations";
  const isVaccines = section === "vaccines";
  const isTreatments = section === "treatments";

  return (
    <>
    <section className={`space-y-6 ${isDirectory ? "clinic-directory" : ""}${isConsultations ? " consultations-page" : ""}${isVaccines ? " vaccine-records-page" : ""}${isTreatments ? " treatment-records-page" : ""}`}>
      <div className={`clinic-page-heading${isDirectory ? " clinic-page-heading--directory" : ""}${isConsultations ? " clinic-page-heading--consultations" : ""}${isVaccines ? " clinic-page-heading--vaccines" : ""}${isTreatments ? " clinic-page-heading--treatments" : ""}`}>
        <div className="clinic-page-heading-copy">
          <span className="clinic-page-icon" aria-hidden="true">
            <ClinicIcon
              name={
                section === "owners"
                  ? "owners"
                  : section === "pets"
                    ? "pets"
                    : isVaccines
                      ? "vaccine"
                      : isTreatments
                        ? "treatment"
                        : "records"
              }
            />
          </span>
          <div>
            <p className="clinic-page-eyebrow">
              {section === "owners"
                ? "RED DE CUIDADO"
                : section === "pets"
                  ? "PACIENTES DE LA CLÍNICA"
                  : isConsultations
                    ? "HISTORIAL DE ATENCIÓN"
                    : isVaccines
                      ? "PREVENCIÓN Y SEGUIMIENTO"
                      : isTreatments
                        ? "CUIDADO Y TRATAMIENTO"
                        : "EXPEDIENTE CLÍNICO"}
            </p>
            <h1>{title.title}</h1>
            <p>{title.description}</p>
          </div>
        </div>
        <div className={`clinic-page-tools${isConsultations ? " consultations-page-tools" : ""}${isVaccines ? " vaccine-records-tools" : ""}${isTreatments ? " treatment-records-tools" : ""}`}>
          {section === "vaccines" && (
            <div className="inline-flex rounded-xl border border-line bg-surface-raised p-1">
              {(["all", "Perro", "Gato"] as const).map((option) => (
                <button
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    speciesFilter === option
                      ? "bg-ayala-blue text-white shadow-sm"
                      : "text-muted hover:text-primary"
                  }`}
                  key={option}
                  onClick={() => {
                    setPage(1);
                    setSpeciesFilter(option);
                  }}
                  type="button"
                >
                  {option === "all" ? "Todos" : option === "Perro" ? "Perros" : "Gatos"}
                </button>
              ))}
            </div>
          )}
          <label className="block w-full sm:max-w-xs">
            <span className="sr-only">Buscar {title.title.toLowerCase()}</span>
            <ClinicIcon name="search" />
            <input
              className={`w-full rounded-xl border border-line bg-surface-raised py-3 pl-10 pr-4 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15${isDirectory ? " clinic-search-input" : ""}`}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder={`Buscar ${title.title.toLowerCase()}...`}
              type="search"
              value={search}
            />
          </label>
        </div>
      </div>

      <div className={`grid clinic-content-grid ${isDirectory ? "clinic-content-grid--directory" : ""}${isConsultations ? " consultations-content-grid" : ""}${isVaccines ? " vaccine-records-content-grid" : ""}${isTreatments ? " treatment-records-content-grid" : ""} ${canEdit || isClinical ? "xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]" : ""}`}>
        <div className={`card-surface min-w-0 rounded-2xl border border-line bg-surface-raised shadow-card${isDirectory ? " clinic-records-panel" : ""}`}>
          <div className="clinic-records-heading flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold text-primary">{section === "pets" ? "Pacientes registrados" : section === "owners" ? "Directorio de propietarios" : "Registros"}</h2>
              <p className="mt-1 text-xs text-muted">
                {loading ? "Cargando..." : `${totalCount} ${section === "pets" ? "pacientes" : section === "owners" ? "propietarios" : "registros"}`}
              </p>
            </div>
            {isDirectory && !loading && (
              <span className="clinic-count-pill">
                <span />
                {totalCount} {section === "pets" ? "en el directorio" : "contactos"}
              </span>
            )}
          </div>
          {error && (
            <p className="notice-animate mx-5 mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice-animate mx-5 mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent" role="status">
              {notice}
            </p>
          )}
          {loading ? (
            <p aria-live="polite" className="p-8 text-center text-sm text-muted">Cargando registros...</p>
          ) : totalCount === 0 ? (
            <div className="clinic-empty-state">
              <span><ClinicIcon name={section === "owners" ? "owners" : section === "pets" ? "pets" : "records"} /></span>
              <h3>{section === "pets" ? "Aún no hay pacientes registrados" : section === "owners" ? "Aún no hay propietarios registrados" : "No hay registros para mostrar"}</h3>
              <p>Los nuevos registros aparecerán aquí una vez guardados en el sistema.</p>
            </div>
          ) : (
            <div className={isDirectory ? "clinic-directory-list" : isConsultations ? "consultations-list" : isVaccines ? "vaccine-records-list" : isTreatments ? "treatment-records-list" : "divide-y divide-line"}>
              {section === "owners" &&
                owners.map((owner) => (
                  <OwnerDirectoryCard
                    key={owner.id}
                    onEdit={() => setEditing(owner)}
                    owner={owner}
                  />
                ))}
              {section === "pets" &&
                pets.map((pet) => (
                  <PetDirectoryCard
                    key={pet.id}
                    onEdit={() => setEditing(pet)}
                    pet={pet}
                    receptionist={user?.role === "RECEPTIONIST"}
                  />
                ))}
              {isClinical &&
                entries.map((entry) => (
                  <ClinicalCard
                    entry={entry}
                    key={entry.id}
                    onPrintPrescription={
                      isConsultations
                        ? () => setPrescriptionConsultationId(entry.id)
                        : undefined
                    }
                    section={section}
                  />
                ))}
            </div>
          )}
          {!loading && totalCount > 25 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-4">
              <span className="text-xs text-muted">
                Página {page} de {Math.ceil(totalCount / 25)}
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
                  disabled={page >= Math.ceil(totalCount / 25)}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {(canEdit || isClinical) && (
          <form
            className={`clinic-entry-form h-fit space-y-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6${isDirectory ? " clinic-entry-form--directory" : ""}${isConsultations ? " consultations-entry-form" : ""}${isVaccines ? " vaccine-entry-form" : ""}${isTreatments ? " treatment-entry-form" : ""}`}
            key={`${section}-${editing?.id ?? "new"}`}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="clinic-form-eyebrow">{editing ? "ACTUALIZA LA INFORMACIÓN" : isClinical ? "REGISTRO CLÍNICO" : "AGREGA A TU DIRECTORIO"}</p>
                <h2 className="font-semibold text-primary">{formTitle}</h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {section === "pets"
                    ? "Completa los datos de identificación y su responsable."
                    : isVaccines
                      ? "Registra la aplicación y, si corresponde, la fecha de seguimiento."
                      : isTreatments
                        ? "Documenta las indicaciones y el periodo del tratamiento."
                        : isConsultations
                          ? "Asocia la consulta con el paciente y registra sus hallazgos."
                          : "Los cambios se guardan en el directorio de la clínica."}
                </p>
              </div>
              {editing && (
                <button
                  aria-label="Cancelar edición"
                  className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-subtle"
                  onClick={() => setEditing(null)}
                  type="button"
                >
                  Cancelar
                </button>
              )}
            </div>

            {section === "owners" && (
              <OwnerForm
                owner={editing && "firstName" in editing ? editing : null}
              />
            )}
            {section === "pets" && (
              <PetForm
                pet={editing && "ownerId" in editing ? editing : null}
                owners={owners}
                receptionist={user?.role === "RECEPTIONIST"}
              />
            )}
            {isClinical && <ClinicalForm pets={pets} section={section} />}

            <button
              className="w-full rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Guardar registro"}
            </button>
          </form>
        )}
      </div>
    </section>
    {prescriptionConsultationId && (
      <PrescriptionComposer
        consultationId={prescriptionConsultationId}
        onClose={() => setPrescriptionConsultationId(null)}
        onSaved={() => setRefreshKey((key) => key + 1)}
      />
    )}
    </>
  );
}

function OwnerDirectoryCard({
  owner,
  onEdit,
}: {
  owner: Owner;
  onEdit: () => void;
}) {
  const petCount = owner._count?.pets ?? 0;
  const initials = `${owner.firstName.charAt(0)}${owner.lastName.charAt(0)}`.toUpperCase();

  return (
    <article className="owner-directory-card">
      <span className="owner-directory-avatar" aria-hidden="true">{initials}</span>
      <div className="owner-directory-main">
        <div className="owner-directory-name-row">
          <div>
            <h3>{owner.firstName} {owner.lastName}</h3>
            <span className="owner-directory-pet-count">
              <ClinicIcon name="pets" />
              {petCount} {petCount === 1 ? "mascota asociada" : "mascotas asociadas"}
            </span>
          </div>
          <button
            aria-label={`Editar a ${owner.firstName} ${owner.lastName}`}
            className="clinic-edit-button"
            onClick={onEdit}
            type="button"
          >
            <ClinicIcon name="edit" />
            <span>Editar</span>
          </button>
        </div>
        <div className="owner-directory-contact">
          <a href={`tel:${owner.phone}`}>
            <ClinicIcon name="phone" />
            {owner.phone}
          </a>
          {owner.email && (
            <a href={`mailto:${owner.email}`}>
              <ClinicIcon name="mail" />
              {owner.email}
            </a>
          )}
          {owner.address && (
            <span>
              <ClinicIcon name="location" />
              {owner.address}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function PetDirectoryCard({
  pet,
  receptionist,
  onEdit,
}: {
  pet: Pet;
  receptionist: boolean;
  onEdit: () => void;
}) {
  const ownerName = pet.owner
    ? `${pet.owner.firstName} ${pet.owner.lastName}`
    : "Propietario no asignado";
  const age = pet.birthDate ? formatPetAge(pet.birthDate) : null;
  const speciesIcon = normalizeSpecies(pet.species) === "Gato" ? "cat" : "dog";
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <article className="pet-directory-card">
      <div className={`pet-directory-photo pet-directory-photo--${speciesIcon}`}>
        {pet.photoPath && !photoFailed ? (
          <img
            alt={`Fotografía de ${pet.name}`}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            src={pet.photoPath}
          />
        ) : (
          <ClinicIcon name={speciesIcon} />
        )}
        <span className="pet-directory-species">{pet.species}</span>
      </div>
      <div className="pet-directory-content">
        <div className="pet-directory-title-row">
          <div>
            <p className="pet-directory-caption">PACIENTE</p>
            <h3>{pet.name}</h3>
            <p className="pet-directory-breed">{pet.breed || "Raza no especificada"}</p>
          </div>
          <button
            aria-label={`Editar ficha de ${pet.name}`}
            className="clinic-edit-button"
            onClick={onEdit}
            type="button"
          >
            <ClinicIcon name="edit" />
            <span>Editar</span>
          </button>
        </div>
        <div className="pet-directory-details">
          {age && (
            <span>
              <ClinicIcon name="calendar" />
              {age}
            </span>
          )}
          <span>
            <ClinicIcon name="gender" />
            {petSexLabel(pet.sex)}
          </span>
          {pet.color && <span className="pet-detail-color">{pet.color}</span>}
          {!receptionist && pet.weightKg != null && pet.weightKg !== "" && (
            <span>
              <ClinicIcon name="weight" />
              {pet.weightKg} kg
            </span>
          )}
        </div>
        <div className="pet-directory-owner">
          <span className="pet-owner-avatar" aria-hidden="true">
            {ownerName.charAt(0).toUpperCase()}
          </span>
          <span>
            <small>RESPONSABLE</small>
            <strong>{ownerName}</strong>
          </span>
          {pet.owner?.phone && (
            <a aria-label={`Llamar a ${ownerName}`} href={`tel:${pet.owner.phone}`}>
              <ClinicIcon name="phone" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function formatPetAge(value: string): string | null {
  const dateValue = value.slice(0, 10);
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() > Date.now()) {
    return null;
  }
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  if (now.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 1 && months < 1) return "Menos de 1 mes";
  if (years < 1) return `${months} ${months === 1 ? "mes" : "meses"}`;
  if (months === 0) return `${years} ${years === 1 ? "año" : "años"}`;
  return `${years} a ${months} m`;
}

function petSexLabel(sex: Pet["sex"]): string {
  if (sex === "FEMALE") return "Hembra";
  if (sex === "MALE") return "Macho";
  return "Sin especificar";
}

function ClinicIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    owners: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7m2 3.3a4 4 0 0 1 2 3.5V21",
    pets: "M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm14 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-7 3c-2.7 0-5 2.4-5 4.5a2 2 0 0 0 2.7 1.9c1.5-.6 3.1-.6 4.6 0A2 2 0 0 0 17 15.5c0-2.1-2.3-4.5-5-4.5Z",
    records: "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5H8Zm7 0v5h5m-12 4h8m-8 4h8",
    search: "m20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    edit: "m12 20 8.5-8.5a2.1 2.1 0 0 0-3-3L9 17l-1 4 4-1ZM14 7l3 3",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7l.5 3.1a2 2 0 0 1-.6 1.7l-1.6 1.6a16 16 0 0 0 5.5 5.5l1.6-1.6a2 2 0 0 1 1.7-.6l3.1.5a2 2 0 0 1 1.7 2Z",
    mail: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm18 2-10 7L2 7",
    location: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    calendar: "M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h3",
    dog: "M5 11 3 8l2-2 3 2h6l3-3 4 2-1 5-2 2v5h-3l-1-4h-4l-1 4H6v-6l-1-2Zm3 1h.01M16 12h.01M10 15h4",
    cat: "M5 9 4 3l5 3a9 9 0 0 1 6 0l5-3-1 6a9 9 0 1 1-14 0Zm4 5h.01M15 14h.01m-4 2 1 1 1-1m-4 1H7m10 0h-2",
    gender: "M19 5h-5m5 0v5m0-5-6 6m-2 1a5 5 0 1 1-7 7 5 5 0 0 1 7-7Z",
    weight: "M5 8h14l2 13H3L5 8Zm4 0a3 3 0 0 1 6 0m-3 4v3",
    vaccine: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3.5-11 2.3 2.3 4.7-4.7",
    treatment: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z",
  };
  const filled = name === "pets";

  return (
    <svg
      aria-hidden="true"
      className="clinic-icon"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d={paths[name] ?? paths.records} />
    </svg>
  );
}

function OwnerForm({ owner }: { owner: Owner | null }) {
  return (
    <>
      <TextField defaultValue={owner?.firstName} label="Nombre" name="firstName" required />
      <TextField defaultValue={owner?.lastName} label="Apellidos" name="lastName" required />
      <TextField defaultValue={owner?.phone} label="Teléfono" name="phone" required type="tel" />
      <TextField defaultValue={owner?.email ?? ""} label="Correo electrónico" name="email" type="email" />
      <TextField defaultValue={owner?.address ?? ""} label="Domicilio" name="address" />
      <TextField defaultValue={owner?.notes ?? ""} label="Notas" name="notes" />
    </>
  );
}

function PetForm({
  pet,
  owners,
  receptionist,
}: {
  pet: Pet | null;
  owners: Owner[];
  receptionist: boolean;
}) {
  return (
    <>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-primary">Propietario</span>
        <select className={inputClass} defaultValue={pet?.ownerId ?? ""} name="ownerId" required>
          <option value="">Selecciona un propietario</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName}</option>
          ))}
        </select>
      </label>
      <TextField defaultValue={pet?.name} label="Nombre de la mascota" name="name" required />
      <TextField defaultValue={pet?.species} label="Especie" name="species" placeholder="Perro, gato..." required />
      <TextField defaultValue={pet?.breed ?? ""} label="Raza" name="breed" />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-primary">Sexo</span>
        <select className={inputClass} defaultValue={pet?.sex ?? "UNKNOWN"} name="sex">
          <option value="UNKNOWN">No especificado</option>
          <option value="FEMALE">Hembra</option>
          <option value="MALE">Macho</option>
        </select>
      </label>
      <TextField defaultValue={pet?.birthDate?.slice(0, 10)} label="Fecha de nacimiento" name="birthDate" type="date" />
      <TextField defaultValue={pet?.color ?? ""} label="Color" name="color" />
      <TextField defaultValue={pet?.microchip ?? ""} label="Microchip" name="microchip" />
      {!receptionist && (
        <>
          <TextField defaultValue={pet?.weightKg?.toString() ?? ""} label="Peso (kg)" name="weightKg" step="0.01" type="number" />
          <TextArea defaultValue={pet?.medicalNotes ?? ""} label="Notas clínicas" name="medicalNotes" />
        </>
      )}
    </>
  );
}

function ClinicalForm({ pets, section }: { pets: Pet[]; section: ClinicSection }) {
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedVaccineName, setSelectedVaccineName] = useState("");

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const selectedSpecies = normalizeSpecies(selectedPet?.species ?? "");
  const vaccineOptions = useMemo(
    () => getVacunasPorEspecie(selectedSpecies ?? undefined),
    [selectedSpecies],
  );

  useEffect(() => {
    if (section !== "vaccines") return;

    if (!selectedSpecies || vaccineOptions.length === 0) {
      setSelectedVaccineName("");
      return;
    }

    setSelectedVaccineName((current) =>
      vaccineOptions.includes(current) ? current : vaccineOptions[0],
    );
  }, [section, selectedSpecies, vaccineOptions]);

  return (
    <>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-primary">Paciente</span>
        <select
          className={inputClass}
          name="petId"
          onChange={(event) => setSelectedPetId(event.target.value)}
          required
          value={selectedPetId}
        >
          <option value="">Selecciona una mascota</option>
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-primary">Turno (opcional)</span>
        <select className={inputClass} name="shift" defaultValue="">
          <option value="">No especificado</option>
          <option value="MORNING">Matutino</option>
          <option value="AFTERNOON">Vespertino</option>
        </select>
      </label>
      {section === "consultations" && (
        <>
          <TextField label="Motivo de consulta" name="reason" required />
          <TextField label="Fecha y hora" name="occurredAt" type="datetime-local" />
          <TextField label="Peso (kg)" name="weightKg" step="0.01" type="number" />
          <TextArea label="Diagnóstico" name="diagnosis" />
          <TextArea label="Notas y plan" name="notes" />
        </>
      )}
      {section === "vaccines" && (
        <>
          <div className="rounded-xl border border-line bg-subtle px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {selectedSpecies ? `Vacunas para ${selectedSpecies}` : "Especie no detectada"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {selectedSpecies
                ? "La lista se actualiza según la mascota seleccionada."
                : "Selecciona una mascota para mostrar las vacunas disponibles."}
            </p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-primary">Vacuna</span>
            <select
              className={inputClass}
              disabled={!selectedSpecies || vaccineOptions.length === 0}
              name="name"
              onChange={(event) => setSelectedVaccineName(event.target.value)}
              required
              value={selectedVaccineName}
            >
              <option value="">
                {selectedSpecies
                  ? "Selecciona una vacuna disponible"
                  : "Debes elegir primero una mascota"}
              </option>
              {vaccineOptions.map((vaccine) => (
                <option key={vaccine} value={vaccine}>
                  {vaccine}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Fecha de aplicación" name="administeredAt" required type="datetime-local" />
          <TextField label="Próxima dosis" name="nextDueAt" type="datetime-local" />
          <TextField label="Lote" name="batchNumber" />
          <TextArea label="Notas" name="notes" />
        </>
      )}
      {section === "treatments" && (
        <>
          <TextField label="Tratamiento" name="name" required />
          <TextField label="Dosis" name="dosage" />
          <TextField label="Inicio" name="startsAt" required type="datetime-local" />
          <TextField label="Fin" name="endsAt" type="datetime-local" />
          <TextArea label="Indicaciones" name="instructions" />
        </>
      )}
    </>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15";

function TextField({
  label,
  name,
  required = false,
  type = "text",
  defaultValue,
  placeholder,
  step,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input
        className={inputClass}
        defaultValue={defaultValue}
        maxLength={type === "email" ? 191 : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <textarea
        className={`${inputClass} min-h-20 resize-y`}
        defaultValue={defaultValue}
        maxLength={10000}
        name={name}
        rows={3}
      />
    </label>
  );
}

function ClinicalCard({
  entry,
  section,
  onPrintPrescription,
}: {
  entry: ClinicalEntry;
  section: ClinicSection;
  onPrintPrescription?: () => void;
}) {
  const dateValue =
    entry.occurredAt ?? entry.administeredAt ?? entry.startsAt ?? "";
  const title =
    section === "consultations"
      ? entry.reason
      : entry.name;
  const author = entry.author?.name ?? entry.administrator?.name;
  const isVaccine = section === "vaccines";
  const isTreatment = section === "treatments";

  return (
    <article className={`px-5 py-4${section === "consultations" ? " consultation-record-card" : ""}${isVaccine ? " vaccine-record-card" : ""}${isTreatment ? " treatment-record-card" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-primary">{title}</h3>
          <p className="mt-1 text-sm text-muted">{entry.pet.name} · {entry.pet.species}</p>
        </div>
        <time className="text-xs text-muted" dateTime={dateValue}>
          {formatDate(dateValue)}
        </time>
      </div>
      {isTreatment && entry.endsAt && (
        <div className="treatment-record-period">
          <span>Periodo</span>
          <strong>{formatDate(entry.startsAt ?? dateValue)} – {formatDate(entry.endsAt)}</strong>
        </div>
      )}
      {(entry.diagnosis || entry.dosage) && (
        <p className="mt-2 text-sm text-primary">
          {entry.diagnosis ?? `Dosis: ${entry.dosage}`}
        </p>
      )}
      {(entry.notes || entry.instructions) && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted">
          {entry.notes ?? entry.instructions}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Turno: {entry.shift === "MORNING" ? "Matutino" : entry.shift === "AFTERNOON" ? "Vespertino" : "No especificado"}
      </p>
      {author && <p className="mt-2 text-xs text-muted">Registró: {author}</p>}
      {section === "vaccines" && entry.nextDueAt && (
        <div className="vaccine-record-details">
          <span>
            <small>Próxima dosis</small>
            <strong>{formatDate(entry.nextDueAt)}</strong>
          </span>
          {entry.batchNumber && (
            <span>
              <small>Lote</small>
              <strong>{entry.batchNumber}</strong>
            </span>
          )}
        </div>
      )}
      {isVaccine && !entry.nextDueAt && entry.batchNumber && (
        <div className="vaccine-record-details">
          <span>
            <small>Lote</small>
            <strong>{entry.batchNumber}</strong>
          </span>
        </div>
      )}
      {section === "consultations" && onPrintPrescription && (
        <button
          className="mt-3 inline-flex items-center rounded-lg border border-line px-3 py-2 text-xs font-semibold text-primary transition hover:border-accent hover:text-accent"
          onClick={onPrintPrescription}
          type="button"
        >
          {entry.prescription ? "Ver / imprimir receta" : "Imprimir receta"}
        </button>
      )}
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
