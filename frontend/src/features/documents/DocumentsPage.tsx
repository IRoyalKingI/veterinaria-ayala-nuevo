import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import PrescriptionComposer from "../clinic/PrescriptionComposer";
import ClinicalAnalysisComposer from "./ClinicalAnalysisComposer";
import EuthanasiaAuthorizationComposer from "./EuthanasiaAuthorizationComposer";

type DocumentType =
  | "PRESCRIPTION"
  | "EUTHANASIA_AUTHORIZATION"
  | "CLINICAL_ANALYSIS";

interface PetRecord {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  microchip: string | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}

interface ListResult<T> {
  data: T[];
}

interface ConsultationRecord {
  id: string;
  occurredAt: string;
  reason: string;
  pet: { id: string; name: string; species: string };
  prescription: { id: string; generatedAt: string } | null;
}

const documentTypes: Array<{ value: DocumentType; label: string }> = [
  { value: "PRESCRIPTION", label: "Receta veterinaria (formato oficial)" },
  { value: "EUTHANASIA_AUTHORIZATION", label: "Autorización de eutanasia" },
  { value: "CLINICAL_ANALYSIS", label: "Formato Análisis Clínicos" },
];

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documentType, setDocumentType] =
    useState<DocumentType>("EUTHANASIA_AUTHORIZATION");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PetRecord[]>([]);
  const [selectedPet, setSelectedPet] = useState<PetRecord | null>(null);
  const [consultationSearch, setConsultationSearch] = useState("");
  const [consultationResults, setConsultationResults] = useState<ConsultationRecord[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationRecord | null>(null);
  const [prescriptionConsultationId, setPrescriptionConsultationId] = useState<string | null>(null);
  const [euthanasiaPetId, setEuthanasiaPetId] = useState<string | null>(null);
  const [clinicalAnalysisPetId, setClinicalAnalysisPetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consultationsLoading, setConsultationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPreparePrescription =
    user?.role === "ADMIN" || user?.role === "VETERINARIAN";
  const canPrepareClinicalAnalysis =
    user?.role === "ADMIN" || user?.role === "VETERINARIAN";
  const availableDocumentTypes = documentTypes.filter(
    (option) =>
      (option.value !== "PRESCRIPTION" || canPreparePrescription) &&
      (option.value !== "CLINICAL_ANALYSIS" || canPrepareClinicalAnalysis),
  );

  useEffect(() => {
    const query = search.trim();
    if (documentType === "PRESCRIPTION" || query.length < 2 || selectedPet) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .get<ListResult<PetRecord>>("/pets", {
          params: { search: query, limit: 100 },
        })
        .then(({ data }) => {
          if (active) setResults(data.data);
        })
        .catch((requestError: unknown) => {
          if (active) setError(getRequestError(requestError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, selectedPet, documentType]);

  useEffect(() => {
    const query = consultationSearch.trim();
    if (
      documentType !== "PRESCRIPTION" ||
      query.length < 2 ||
      selectedConsultation
    ) {
      setConsultationResults([]);
      setConsultationsLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setConsultationsLoading(true);
      setError(null);
      api
        .get<ListResult<ConsultationRecord>>("/clinical/consultations", {
          params: { search: query, limit: 100 },
        })
        .then(({ data }) => {
          if (active) setConsultationResults(data.data);
        })
        .catch((requestError: unknown) => {
          if (active) setError(getRequestError(requestError));
        })
        .finally(() => {
          if (active) setConsultationsLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [consultationSearch, selectedConsultation, documentType]);

  return (
    <section className="documents-page space-y-6">
      <div className="documents-heading no-print">
        <span className="documents-heading-icon" aria-hidden="true">
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
            <path d="M7 3h7l5 5v13H5V5a2 2 0 0 1 2-2Zm7 0v5h5m-9 5h6m-6 4h6" />
          </svg>
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Documentos de la clínica
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
            Documentos y recetario
          </h1>
          <p className="mt-2 text-sm text-muted">
            Consulta los formatos disponibles y completa los documentos con datos registrados.
          </p>
        </div>
      </div>

      <div className="documents-controls no-print grid gap-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6 lg:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-primary">Tipo de documento</span>
          <select
            className={inputClass}
            onChange={(event) => {
              const nextType = event.target.value as DocumentType;
              setDocumentType(nextType);
              setSelectedPet(null);
              setSelectedConsultation(null);
              setEuthanasiaPetId(null);
              setClinicalAnalysisPetId(null);
              setSearch("");
              setConsultationSearch("");
              setError(null);
            }}
            value={documentType}
          >
            {availableDocumentTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {documentType === "PRESCRIPTION" ? (
          <div className="documents-search space-y-1.5">
            <label className="block text-sm font-medium text-primary" htmlFor="consultation-search">
              Buscar una consulta
            </label>
            <input
              autoComplete="off"
              className={inputClass}
              id="consultation-search"
              onChange={(event) => {
                setConsultationSearch(event.target.value);
                setSelectedConsultation(null);
              }}
              placeholder="Motivo, diagnóstico o mascota"
              type="search"
              value={
                selectedConsultation
                  ? `${selectedConsultation.pet.name} · ${selectedConsultation.reason}`
                  : consultationSearch
              }
            />
            {consultationsLoading && <p aria-live="polite" className="text-xs text-muted">Buscando consultas...</p>}
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            {!consultationsLoading && !error && consultationSearch.trim().length >= 2 && !selectedConsultation && (
              <div className="documents-search-results max-h-56 overflow-y-auto rounded-xl border border-line">
                {consultationResults.length ? consultationResults.map((consultation) => (
                  <button
                    className="block w-full border-b border-line px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-subtle"
                    key={consultation.id}
                    onClick={() => {
                      setSelectedConsultation(consultation);
                      setConsultationSearch("");
                      setConsultationResults([]);
                    }}
                    type="button"
                  >
                    <span className="font-semibold text-primary">
                      {consultation.pet.name} · {consultation.pet.species} · {consultation.reason}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDate(consultation.occurredAt)}
                      {consultation.prescription ? " · Receta guardada" : ""}
                    </span>
                  </button>
                )) : (
                  <p className="px-3 py-3 text-sm text-muted">No se encontraron consultas.</p>
                )}
              </div>
            )}
            {selectedConsultation && (
              <button
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => {
                  setSelectedConsultation(null);
                  setConsultationSearch("");
                }}
                type="button"
              >
                Cambiar consulta
              </button>
            )}
          </div>
        ) : (
          <div className="documents-search space-y-1.5">
            <label className="block text-sm font-medium text-primary" htmlFor="pet-search">
              Buscar mascota registrada
            </label>
            <input
              autoComplete="off"
              className={inputClass}
              id="pet-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedPet(null);
              }}
              placeholder="Nombre, especie, propietario o teléfono"
              type="search"
              value={selectedPet ? `${selectedPet.name} · ${selectedPet.species}` : search}
            />
            {loading && <p aria-live="polite" className="text-xs text-muted">Buscando mascotas...</p>}
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            {!loading && !error && search.trim().length >= 2 && !selectedPet && (
              <div className="documents-search-results max-h-56 overflow-y-auto rounded-xl border border-line">
                {results.length ? results.map((pet) => (
                  <button
                    className="block w-full border-b border-line px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-subtle"
                    key={pet.id}
                    onClick={() => {
                      setSelectedPet(pet);
                      setSearch("");
                      setResults([]);
                    }}
                    type="button"
                  >
                    <span className="font-semibold text-primary">{pet.name} · {pet.species}</span>
                    <span className="block text-xs text-muted">
                      Propietario: {pet.owner.firstName} {pet.owner.lastName} · {pet.owner.phone}
                    </span>
                  </button>
                )) : (
                  <p className="px-3 py-3 text-sm text-muted">No se encontraron mascotas.</p>
                )}
              </div>
            )}
            {selectedPet && (
              <button
                className="text-xs font-semibold text-accent hover:underline"
                onClick={() => {
                  setSelectedPet(null);
                  setSearch("");
                }}
                type="button"
              >
                Cambiar mascota
              </button>
            )}
          </div>
        )}
      </div>

      {documentType === "PRESCRIPTION" ? (
        <section className="space-y-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6">
          <div className="documents-template-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Plantilla predeterminada disponible
            </p>
            <h2 className="mt-1 text-lg font-semibold text-primary">
              RECETARIO NUEVO 2026.docx
            </h2>
            <p className="mt-1 text-sm text-muted">
              Documentos\Plantillas\RECETARIO NUEVO 2026.docx · se conserva el diseño y el logotipo originales.
            </p>
          </div>
          {selectedConsultation ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4">
              <div>
                <h3 className="font-semibold text-primary">
                  {selectedConsultation.pet.name} · {selectedConsultation.pet.species}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {selectedConsultation.reason} · {formatDate(selectedConsultation.occurredAt)}
                </p>
                {selectedConsultation.prescription && (
                  <p className="mt-1 text-xs font-medium text-accent">
                    Ya existe una receta relacionada; al guardar se actualizará sin duplicarla.
                  </p>
                )}
              </div>
              <button
                className="rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50]"
                onClick={() => setPrescriptionConsultationId(selectedConsultation.id)}
                type="button"
              >
                Preparar receta
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Busca y selecciona una consulta para abrir la misma vista de edición e impresión disponible en Consultas.
            </p>
          )}
        </section>
      ) : documentType === "EUTHANASIA_AUTHORIZATION" ? (
        selectedPet ? (
          <section className="space-y-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6">
            <div className="documents-template-card">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                Plantilla oficial disponible
              </p>
              <h2 className="mt-1 text-lg font-semibold text-primary">
                Autorización de Eutanasia
              </h2>
              <p className="mt-1 text-sm text-muted">
                Documentos\Plantillas\Autorizacion_Eutanasia_Ayala.docx · documento independiente, pendiente de firma.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4">
              <div>
                <h3 className="font-semibold text-primary">
                  {selectedPet.name} · {selectedPet.species}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Propietario(a): {selectedPet.owner.firstName} {selectedPet.owner.lastName}
                </p>
              </div>
              <button
                className="rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50]"
                onClick={() => setEuthanasiaPetId(selectedPet.id)}
                type="button"
              >
                Preparar autorización
              </button>
            </div>
          </section>
        ) : (
          <p className="documents-empty no-print rounded-2xl border border-dashed border-line bg-surface-raised p-8 text-center text-sm text-muted">
            Busca y selecciona una mascota para preparar la autorización con los datos registrados.
          </p>
        )
      ) : documentType === "CLINICAL_ANALYSIS" ? (
        selectedPet ? (
          <section className="space-y-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-card sm:p-6">
            <div className="documents-template-card">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                Plantilla oficial disponible
              </p>
              <h2 className="mt-1 text-lg font-semibold text-primary">
                Formato Análisis Clínicos
              </h2>
              <p className="mt-1 text-sm text-muted">
                Documentos\Plantillas\FORMATO ANALISIS CLINICOS.docx · conserva el diseño original.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4">
              <div>
                <h3 className="font-semibold text-primary">
                  {selectedPet.name} · {selectedPet.species}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Propietario(a): {selectedPet.owner.firstName} {selectedPet.owner.lastName}
                </p>
              </div>
              <button
                className="rounded-xl bg-ayala-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102e50]"
                onClick={() => setClinicalAnalysisPetId(selectedPet.id)}
                type="button"
              >
                Preparar análisis clínicos
              </button>
            </div>
          </section>
        ) : (
          <p className="documents-empty no-print rounded-2xl border border-dashed border-line bg-surface-raised p-8 text-center text-sm text-muted">
            Busca y selecciona una mascota para preparar el formato con los datos registrados.
          </p>
        )
      ) : null}
      {prescriptionConsultationId && (
        <PrescriptionComposer
          consultationId={prescriptionConsultationId}
          onClose={() => setPrescriptionConsultationId(null)}
        />
      )}
      {euthanasiaPetId && (
        <EuthanasiaAuthorizationComposer
          petId={euthanasiaPetId}
          onClose={() => setEuthanasiaPetId(null)}
        />
      )}
      {clinicalAnalysisPetId && (
        <ClinicalAnalysisComposer
          petId={clinicalAnalysisPetId}
          onClose={() => setClinicalAnalysisPetId(null)}
        />
      )}
    </section>
  );
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(date);
}

function getRequestError(error: unknown): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? "No se pudo buscar la mascota.";
  }
  return "No se pudo buscar la mascota. Comprueba tu conexión e inténtalo de nuevo.";
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";
