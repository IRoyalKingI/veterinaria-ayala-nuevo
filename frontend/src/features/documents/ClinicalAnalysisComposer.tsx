import { isAxiosError } from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { api } from "../../lib/api";

interface ClinicalAnalysisData {
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  recordNumber: string;
  petName: string;
  species: string;
  breed: string;
  sex: string;
  age: string;
  weight: string;
  zoottechnicalFunction: string;
  hemogramResults: string[];
  proteinResult: string;
  hemoparasites: string;
  knottMethod: string;
  observations: string;
  hepaticProfileResults: string[];
}

interface PetDetails {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  weightKg: string | null;
  owner: {
    firstName: string;
    lastName: string;
    phone: string;
    address: string | null;
  };
}

interface ClinicalAnalysisHistoryItem {
  id: string;
  generatedAt: string;
  data: ClinicalAnalysisData;
  author: { name: string };
}

interface PetResponse {
  data: {
    pet: PetDetails;
    history: ClinicalAnalysisHistoryItem[];
  };
}

interface Props {
  petId: string;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

const hemogramAnalytes = [
  ["RBC x10¹²/L", "5.5–8.5"],
  ["HCT %", "37–55"],
  ["HGB g/dL", "12–18"],
  ["MCV fL", "60–72"],
  ["MCH pg", "19.5–25.5"],
  ["MCHC g/dL", "32–38.5"],
  ["WBC x10⁹/L", "6–17"],
  ["LYM x10⁹/L", "0.9–5.0"],
  ["MONO x10⁹/L", "0.3–1.5"],
  ["EOS x10⁹/L", "0.1–1.5"],
  ["NEUT x10⁹/L", "3.5–12.0"],
  ["PLT x10⁹/L", "200–500"],
] as const;

const hepaticAnalytes = [
  ["ALT", "4–70"],
  ["AST", "12–55"],
  ["ALP", "6–189"],
  ["GGT", "16–73"],
  ["DBIL", "0.0–5.0"],
  ["TBIL", "0–5"],
  ["NH3", "19–120"],
  ["CHE", "135–278"],
  ["TP", "5.4–7.5"],
  ["ALB", "29–40"],
] as const;

export default function ClinicalAnalysisComposer({ petId, onClose }: Props) {
  const [analysis, setAnalysis] = useState<ClinicalAnalysisData | null>(null);
  const [history, setHistory] = useState<ClinicalAnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const endpoint = `/documents/clinical-analysis/${petId}`;
  const currentKey = useMemo(
    () => (analysis ? JSON.stringify(analysis) : null),
    [analysis],
  );
  const previewIsCurrent = currentKey !== null && currentKey === previewKey;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<PetResponse>(endpoint)
      .then(async ({ data }) => {
        if (!active) return;
        const pet = data.data.pet;
        const initialAnalysis = createInitialData(pet);
        setAnalysis(initialAnalysis);
        setHistory(data.data.history);
        try {
          const preview = await api.post<ArrayBuffer>(
            `${endpoint}/preview`,
            initialAnalysis,
            { responseType: "arraybuffer" },
          );
          await renderDocument(preview.data);
          if (active) setPreviewKey(JSON.stringify(initialAnalysis));
        } catch (previewError: unknown) {
          if (active) setError(getRequestError(previewError));
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

  function updateField<K extends keyof ClinicalAnalysisData>(
    key: K,
    value: ClinicalAnalysisData[K],
  ) {
    setAnalysis((current) => (current ? { ...current, [key]: value } : current));
    setNotice(null);
  }

  async function renderDocument(document: ArrayBuffer) {
    if (!documentRef.current || !stylesRef.current) {
      throw new Error("No se pudo preparar el área de vista previa.");
    }
    const { renderAsync } = await import("docx-preview");
    documentRef.current.replaceChildren();
    stylesRef.current.replaceChildren();
    await renderAsync(document, documentRef.current, stylesRef.current, {
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

  async function generatePreview(nextAnalysis = analysis) {
    if (!nextAnalysis) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<ArrayBuffer>(
        `${endpoint}/preview`,
        nextAnalysis,
        { responseType: "arraybuffer" },
      );
      await renderDocument(data);
      setPreviewKey(JSON.stringify(nextAnalysis));
      setNotice("Vista previa actualizada. Este paso no guarda el documento.");
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function saveAndOpenPrintDialog(action: "print" | "pdf") {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<ArrayBuffer>(
        `${endpoint}/document`,
        analysis,
        { responseType: "arraybuffer" },
      );
      await renderDocument(data);
      setPreviewKey(JSON.stringify(analysis));
      try {
        const updatedHistory = await api.get<PetResponse>(endpoint);
        setHistory(updatedHistory.data.data.history);
      } catch (historyError: unknown) {
        setError(
          `El documento se guardó, pero no se pudo actualizar el historial. ${getRequestError(historyError)}`,
        );
      }
      setNotice(
        action === "pdf"
          ? "Elige “Guardar como PDF” en el diálogo de impresión para descargar el documento."
          : "Documento de análisis clínicos registrado.",
      );
      window.setTimeout(() => window.print(), 100);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DocumentPreviewModal
      className="euthanasia-composer clinical-analysis-composer"
      labelledBy="clinical-analysis-title"
      onClose={onClose}
    >
      <header className="document-modal-header no-print">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Plantilla oficial · FORMATO ANALISIS CLINICOS.docx
          </p>
          <h2 className="mt-1 text-xl font-semibold text-primary" id="clinical-analysis-title">
            Formato Análisis Clínicos
          </h2>
          <p className="mt-1 text-sm text-muted">
            Los resultados están vacíos y deben capturarse por personal autorizado.
          </p>
        </div>
        <button
          aria-label="Cerrar análisis clínicos"
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
        <p aria-live="polite" className="p-8 text-center text-sm text-muted">
          Cargando datos registrados de la mascota...
        </p>
      ) : analysis ? (
        <div className="euthanasia-composer-body">
          <form
            className="euthanasia-editor no-print"
            onSubmit={(event) => {
              event.preventDefault();
              void generatePreview();
            }}
          >
            <section className="euthanasia-form-section">
              <h3>Propietario y paciente</h3>
              <TextField label="Nombre del tutor o propietario" value={analysis.ownerName} onChange={(value) => updateField("ownerName", value)} />
              <TextField label="Domicilio" value={analysis.ownerAddress} onChange={(value) => updateField("ownerAddress", value)} />
              <TextField label="Teléfono" value={analysis.ownerPhone} onChange={(value) => updateField("ownerPhone", value)} />
              <TextField label="Número de expediente" value={analysis.recordNumber} onChange={(value) => updateField("recordNumber", value)} />
              <TextField label="Nombre de la mascota" value={analysis.petName} onChange={(value) => updateField("petName", value)} />
              <TextField label="Especie" value={analysis.species} onChange={(value) => updateField("species", value)} />
              <TextField label="Raza" value={analysis.breed} onChange={(value) => updateField("breed", value)} />
              <TextField label="Sexo" value={analysis.sex} onChange={(value) => updateField("sex", value)} />
              <TextField label="Edad" value={analysis.age} onChange={(value) => updateField("age", value)} />
              <TextField label="Peso" value={analysis.weight} onChange={(value) => updateField("weight", value)} />
              <TextField label="Función zootécnica" value={analysis.zoottechnicalFunction} onChange={(value) => updateField("zoottechnicalFunction", value)} />
            </section>

            <section className="euthanasia-form-section">
              <h3>Hemograma · resultados manuales</h3>
              {hemogramAnalytes.map(([name, reference], index) => (
                <TextField
                  key={name}
                  label={`${name} · referencia ${reference}`}
                  value={analysis.hemogramResults[index] ?? ""}
                  onChange={(value) => updateResult("hemogramResults", index, value)}
                />
              ))}
            </section>

            <section className="euthanasia-form-section">
              <h3>Otros análisis y observaciones</h3>
              <TextField label="Proteínas totales · mg/dL" value={analysis.proteinResult} onChange={(value) => updateField("proteinResult", value)} />
              <TextArea label="Hemoparásitos" value={analysis.hemoparasites} onChange={(value) => updateField("hemoparasites", value)} />
              <TextArea label="Método de Knott" value={analysis.knottMethod} onChange={(value) => updateField("knottMethod", value)} />
              <TextArea label="Observaciones" value={analysis.observations} onChange={(value) => updateField("observations", value)} />
            </section>

            <section className="euthanasia-form-section">
              <h3>Perfil hepático · resultados manuales</h3>
              {hepaticAnalytes.map(([name, reference], index) => (
                <TextField
                  key={name}
                  label={`${name} · referencia ${reference}`}
                  value={analysis.hepaticProfileResults[index] ?? ""}
                  onChange={(value) => updateResult("hepaticProfileResults", index, value)}
                />
              ))}
              <p className="text-xs leading-5 text-muted">
                Unidades, rangos, notas impresas y datos profesionales de la plantilla se conservan.
                Los resultados de la plantilla original no se reutilizan.
              </p>
            </section>

            {history.length > 0 && (
              <section className="euthanasia-history">
                <h3>Análisis clínicos anteriores</h3>
                {history.slice(0, 10).map((item) => (
                  <div className="flex items-center justify-between gap-3" key={item.id}>
                    <p>{formatDateTime(item.generatedAt)} · {item.author.name}</p>
                    <button
                      className="text-xs font-semibold text-accent hover:underline"
                      onClick={() => {
                        setAnalysis(item.data);
                        setPreviewKey(null);
                        setNotice("Se cargó la captura guardada. Actualiza la vista previa para revisarla.");
                      }}
                      type="button"
                    >
                      Cargar
                    </button>
                  </div>
                ))}
              </section>
            )}

            <div className="euthanasia-actions">
              <button className="recipe-secondary-button" disabled={busy} type="submit">
                {busy ? "Preparando..." : "Actualizar vista previa"}
              </button>
              <button
                className="recipe-secondary-button"
                disabled={busy || !previewIsCurrent}
                onClick={() => void saveAndOpenPrintDialog("print")}
                type="button"
              >
                Imprimir análisis
              </button>
              <button
                className="recipe-primary-button"
                disabled={busy || !previewIsCurrent}
                onClick={() => void saveAndOpenPrintDialog("pdf")}
                type="button"
              >
                Descargar PDF
              </button>
              <p className="text-xs leading-5 text-muted">
                “Descargar PDF” abre la impresión del navegador; selecciona “Guardar como PDF”.
              </p>
            </div>
          </form>

          <section className="recipe-preview-column euthanasia-preview-column" aria-label="Vista previa de análisis clínicos">
            <div className="recipe-preview-caption no-print">
              <h3>Vista previa del documento oficial</h3>
              <p>
                {previewIsCurrent
                  ? "Vista previa generada con la plantilla oficial."
                  : "Actualiza la vista previa para reflejar los últimos cambios."}
              </p>
            </div>
            <div className="recipe-docx-render euthanasia-docx-render" id="clinical-analysis-print-area">
              <div className="recipe-docx-styles" ref={stylesRef} />
              <div ref={documentRef} />
            </div>
          </section>
        </div>
      ) : null}
    </DocumentPreviewModal>
  );

  function updateResult(
    field: "hemogramResults" | "hepaticProfileResults",
    index: number,
    value: string,
  ) {
    setAnalysis((current) => {
      if (!current) return current;
      const results = [...current[field]];
      results[index] = value;
      return { ...current, [field]: results };
    });
    setNotice(null);
  }
}

function createInitialData(pet: PetDetails): ClinicalAnalysisData {
  return {
    ownerName: [pet.owner.firstName, pet.owner.lastName].filter(Boolean).join(" "),
    ownerAddress: pet.owner.address ?? "",
    ownerPhone: pet.owner.phone,
    recordNumber: "",
    petName: pet.name,
    species: pet.species,
    breed: pet.breed ?? "",
    sex: sexLabel(pet.sex),
    age: getPetAge(pet.birthDate),
    weight: pet.weightKg ? `${pet.weightKg} kg` : "",
    zoottechnicalFunction: "",
    hemogramResults: Array.from({ length: hemogramAnalytes.length }, () => ""),
    proteinResult: "",
    hemoparasites: "",
    knottMethod: "",
    observations: "",
    hepaticProfileResults: Array.from({ length: hepaticAnalytes.length }, () => ""),
  };
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <textarea
        className={`${fieldClass} min-h-20 resize-y`}
        maxLength={2000}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function sexLabel(sex: PetDetails["sex"]): string {
  if (sex === "MALE") return "Macho";
  if (sex === "FEMALE") return "Hembra";
  return "";
}

function getPetAge(birthDate: string | null): string {
  if (!birthDate) return "";
  const [birthYear, birthMonth, birthDay] = birthDate.slice(0, 10).split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return "";
  const today = new Date();
  let years = today.getFullYear() - birthYear;
  let months = today.getMonth() + 1 - birthMonth;
  if (today.getDate() < birthDay) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "";
  if (years === 0 && months === 0) return "Menos de 1 mes";
  return [
    years ? `${years} ${years === 1 ? "año" : "años"}` : "",
    months ? `${months} ${months === 1 ? "mes" : "meses"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getRequestError(error: unknown): string {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? "No se pudo preparar el formato de análisis clínicos.";
  }
  return "No se pudo preparar el documento. Comprueba tu conexión e inténtalo de nuevo.";
}
