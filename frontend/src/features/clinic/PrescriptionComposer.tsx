import { isAxiosError } from "axios";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../../lib/api";
import DocumentPreviewModal from "../documents/DocumentPreviewModal";

interface Medication {
  name: string;
  dosageFrequency: string;
  durationInstructions: string;
}

interface PrescriptionData {
  date: string;
  ownerName: string;
  ownerPhone: string;
  petName: string;
  species: string;
  breed: string;
  sex: string;
  age: string;
  weight: string;
  diagnosis: string;
  medications: Medication[];
  recommendations: string;
  veterinarianName: string;
}

interface PrescriptionResponse {
  data: {
    prescription: PrescriptionData;
    recipe: { id: string; generatedAt: string } | null;
    treatmentSuggestions: TreatmentSuggestion[];
  };
}

interface TreatmentSuggestion {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  startsAt: string;
  endsAt: string | null;
}

interface Props {
  consultationId: string;
  onClose: () => void;
  onSaved?: () => void;
}

const blankMedication: Medication = {
  name: "",
  dosageFrequency: "",
  durationInstructions: "",
};

const inputClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

export default function PrescriptionComposer({
  consultationId,
  onClose,
  onSaved,
}: Props) {
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [treatmentSuggestions, setTreatmentSuggestions] = useState<TreatmentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const currentKey = useMemo(
    () => (prescription ? JSON.stringify(prescription) : null),
    [prescription],
  );
  const previewIsCurrent = currentKey !== null && currentKey === previewKey;
  const endpoint = `/clinical/consultations/${consultationId}/prescription`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<PrescriptionResponse>(endpoint)
      .then(({ data }) => {
        if (active) {
          setPrescription(data.data.prescription);
          setTreatmentSuggestions(data.data.treatmentSuggestions);
        }
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
  }, [endpoint]);

  function updateField<K extends keyof PrescriptionData>(
    key: K,
    value: PrescriptionData[K],
  ) {
    setPrescription((current) => (current ? { ...current, [key]: value } : current));
    setNotice(null);
  }

  function updateMedication(index: number, key: keyof Medication, value: string) {
    setPrescription((current) => {
      if (!current) return current;
      const medications = current.medications.map((medication, medicationIndex) =>
        medicationIndex === index
          ? { ...medication, [key]: value }
          : medication,
      );
      return { ...current, medications };
    });
    setNotice(null);
  }

  async function renderDocument(data: ArrayBuffer) {
    if (!documentRef.current || !stylesRef.current) {
      throw new Error("No se pudo preparar el área de vista previa.");
    }
    const { renderAsync } = await import("docx-preview");
    documentRef.current.replaceChildren();
    stylesRef.current.replaceChildren();
    await renderAsync(data, documentRef.current, stylesRef.current, {
      inWrapper: true,
      hideWrapperOnPrint: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      debug: false,
      experimental: false,
      className: "docx",
      trimXmlDeclaration: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      ignoreLastRenderedPageBreak: true,
      useBase64URL: true,
      renderChanges: false,
      renderComments: false,
      renderAltChunks: false,
    });
  }

  async function generatePreview() {
    if (!prescription) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<ArrayBuffer>(
        `${endpoint}/preview`,
        prescription,
        { responseType: "arraybuffer" },
      );
      await renderDocument(data);
      setPreviewKey(JSON.stringify(prescription));
      setNotice("Vista previa actualizada. Los datos no se han guardado todavía.");
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function savePrescription() {
    if (!prescription) return false;
    await api.put(endpoint, prescription);
    const { data } = await api.get<ArrayBuffer>(`${endpoint}/document`, {
      responseType: "arraybuffer",
    });
    await renderDocument(data);
    setPreviewKey(JSON.stringify(prescription));
    setNotice("Receta guardada y relacionada con esta consulta.");
    onSaved?.();
    return true;
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await savePrescription();
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await savePrescription();
      window.setTimeout(() => window.print(), 100);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
      <DocumentPreviewModal
        className="recipe-composer"
        labelledBy="recipe-composer-title"
        onClose={onClose}
      >
        <header className="recipe-composer-header no-print">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              Plantilla oficial · RECETARIO NUEVO 2026.docx
            </p>
            <h2 className="mt-1 text-xl font-semibold text-primary" id="recipe-composer-title">
              Preparar receta veterinaria
            </h2>
            <p className="mt-1 text-sm text-muted">
              Revisa los datos antes de guardar o imprimir. Las correcciones solo afectan esta receta.
            </p>
          </div>
          <button
            aria-label="Cerrar receta"
            className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-primary hover:bg-subtle"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </header>

        {error && <p className="recipe-composer-message recipe-composer-error no-print" role="alert">{error}</p>}
        {notice && <p className="recipe-composer-message recipe-composer-notice no-print" role="status">{notice}</p>}

        {loading ? (
          <p aria-live="polite" className="p-8 text-center text-sm text-muted">Cargando datos de la consulta...</p>
        ) : prescription ? (
          <div className="recipe-composer-body">
            <form
              className="recipe-editor no-print"
              onSubmit={(event) => {
                event.preventDefault();
                void generatePreview();
              }}
            >
              <RecipeSection title="Datos del propietario y del paciente">
                <TextField label="Fecha de consulta" type="date" value={prescription.date} onChange={(value) => updateField("date", value)} />
                <TextField label="Nombre del propietario" value={prescription.ownerName} onChange={(value) => updateField("ownerName", value)} />
                <TextField label="Teléfono" value={prescription.ownerPhone} onChange={(value) => updateField("ownerPhone", value)} />
                <TextField label="Nombre de la mascota" value={prescription.petName} onChange={(value) => updateField("petName", value)} />
                <TextField label="Especie" value={prescription.species} onChange={(value) => updateField("species", value)} />
                <TextField label="Raza" value={prescription.breed} onChange={(value) => updateField("breed", value)} />
                <TextField label="Sexo" value={prescription.sex} onChange={(value) => updateField("sex", value)} />
                <TextField label="Edad" value={prescription.age} onChange={(value) => updateField("age", value)} />
                <TextField label="Peso" value={prescription.weight} onChange={(value) => updateField("weight", value)} />
              </RecipeSection>

              <RecipeSection title="Motivo / diagnóstico">
                <TextArea value={prescription.diagnosis} onChange={(value) => updateField("diagnosis", value)} />
              </RecipeSection>

              <RecipeSection title="Medicamentos (máximo 5, como en la plantilla)">
                {prescription.medications.map((medication, index) => (
                  <fieldset className="recipe-medication" key={index}>
                    <legend>Medicamento {index + 1}</legend>
                    <TextField label="Medicamento / presentación" value={medication.name} onChange={(value) => updateMedication(index, "name", value)} />
                    <TextField label="Dosis, vía y frecuencia" value={medication.dosageFrequency} onChange={(value) => updateMedication(index, "dosageFrequency", value)} />
                    <TextArea label="Duración / indicaciones" value={medication.durationInstructions} onChange={(value) => updateMedication(index, "durationInstructions", value)} />
                    <button
                      className="recipe-remove-medication"
                      onClick={() => updateField("medications", prescription.medications.filter((_, medicationIndex) => medicationIndex !== index))}
                      type="button"
                    >
                      Quitar medicamento
                    </button>
                  </fieldset>
                ))}
                {prescription.medications.length < 5 && (
                  <button
                    className="recipe-secondary-button"
                    onClick={() => updateField("medications", [...prescription.medications, { ...blankMedication }])}
                    type="button"
                  >
                    Agregar medicamento
                  </button>
                )}
              </RecipeSection>
              <section className="recipe-treatment-suggestions">
                <h3>Tratamientos registrados para esta mascota</h3>
                <p>
                  Estos tratamientos coinciden con la fecha de consulta, pero no están vinculados directamente a ella.
                  Agrégalos solo si corresponden a esta receta.
                </p>
                {treatmentSuggestions.length ? (
                  treatmentSuggestions.map((treatment) => (
                    <div className="recipe-treatment-suggestion" key={treatment.id}>
                      <div>
                        <strong>{treatment.name}</strong>
                        <span>
                          {[treatment.dosage, treatment.instructions]
                            .filter(Boolean)
                            .join(" · ") || "Sin dosis ni indicaciones registradas"}
                        </span>
                      </div>
                      <button
                        className="recipe-secondary-button"
                        disabled={prescription.medications.length >= 5}
                        onClick={() => updateField("medications", [
                          ...prescription.medications,
                          {
                            name: treatment.name,
                            dosageFrequency: treatment.dosage ?? "",
                            durationInstructions: [
                              treatment.instructions,
                              treatment.endsAt
                                ? `Hasta ${formatDate(treatment.endsAt)}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          },
                        ])}
                        type="button"
                      >
                        Agregar
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No hay tratamientos registrados para esa fecha.</p>
                )}
              </section>

              <RecipeSection title="Recomendaciones / cuidados en casa">
                <TextArea value={prescription.recommendations} onChange={(value) => updateField("recommendations", value)} />
              </RecipeSection>

              <RecipeSection title="Veterinario responsable">
                <p className="text-sm text-muted">
                  La receta quedará firmada a nombre de la sesión activa:{" "}
                  <strong className="text-primary">{prescription.veterinarianName}</strong>
                </p>
              </RecipeSection>

              <div className="recipe-editor-actions">
                <button className="recipe-secondary-button" disabled={busy} type="submit">
                  {busy ? "Generando..." : "Actualizar vista previa"}
                </button>
                <button className="recipe-secondary-button" disabled={busy} onClick={() => void handleSave()} type="button">
                  {busy ? "Guardando..." : "Guardar receta"}
                </button>
                <button className="recipe-primary-button" disabled={busy} onClick={() => void handlePrint()} type="button">
                  {busy ? "Preparando..." : "Guardar e imprimir / PDF"}
                </button>
              </div>
              <p className="text-xs leading-5 text-muted">
                Para obtener un PDF, elige “Guardar como PDF” en el diálogo de impresión del navegador.
              </p>
            </form>

            <section className="recipe-preview-column" aria-label="Vista previa del documento oficial">
              <div className="recipe-preview-caption no-print">
                <h3>Vista previa del recetario</h3>
                <p>
                  {previewIsCurrent
                    ? "Formato generado a partir de la plantilla Word oficial."
                    : "Genera la vista previa para revisar los cambios antes de imprimir."}
                </p>
              </div>
              <div className="recipe-docx-render" id="recipe-print-area">
                <div className="recipe-docx-styles" ref={stylesRef} />
                <div ref={documentRef} />
              </div>
            </section>
          </div>
        ) : null}
      </DocumentPreviewModal>
  );
}

function RecipeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="recipe-editor-section">
      <h3>{title}</h3>
      <div className="recipe-editor-fields">{children}</div>
    </section>
  );
}

function TextField({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-primary">{label}</span>}
      <textarea className={`${inputClass} min-h-20 resize-y`} maxLength={5000} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function getRequestError(error: unknown): string {
  if (isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData &&
      typeof responseData.error === "string"
    ) {
      return responseData.error;
    }
  }
  return "No se pudo preparar la receta. Comprueba tu conexión e inténtalo de nuevo.";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}
