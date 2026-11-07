import { isAxiosError } from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { api } from "../../lib/api";

interface AuthorizationData {
  ownerName: string;
  ownerPhone: string;
  petName: string;
  species: string;
  breed: string;
  age: string;
  sex: string;
  weight: string;
  address: string;
  identification: string;
  documentDate: string;
  diagnosis: string;
  prognosis: string;
  alternatives: string;
  time: string;
  place: string;
  otherDisposition: string;
}

interface PetDetails {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  microchip: string | null;
  weightKg: string | null;
  owner: {
    firstName: string;
    lastName: string;
    phone: string;
    address: string | null;
  };
}

interface AuthorizationHistoryItem {
  id: string;
  generatedAt: string;
  author: { name: string };
}

interface PetResponse {
  data: { pet: PetDetails; history: AuthorizationHistoryItem[] };
}

interface Props {
  petId: string;
  onClose: () => void;
}

const fieldClass =
  "w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none focus:border-accent focus:ring-4 focus:ring-accent/15";

export default function EuthanasiaAuthorizationComposer({
  petId,
  onClose,
}: Props) {
  const [authorization, setAuthorization] = useState<AuthorizationData | null>(null);
  const [history, setHistory] = useState<AuthorizationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const endpoint = `/documents/euthanasia/${petId}`;
  const currentKey = useMemo(
    () => (authorization ? JSON.stringify(authorization) : null),
    [authorization],
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
        const initialAuthorization: AuthorizationData = {
          ownerName: [pet.owner.firstName, pet.owner.lastName].filter(Boolean).join(" "),
          ownerPhone: pet.owner.phone,
          petName: pet.name,
          species: pet.species,
          breed: pet.breed ?? "",
          age: getPetAge(pet.birthDate),
          sex: sexLabel(pet.sex),
          weight: pet.weightKg ? `${pet.weightKg} kg` : "",
          address: pet.owner.address ?? "",
          identification: pet.microchip ?? "",
          documentDate: getLocalDate(),
          diagnosis: "",
          prognosis: "",
          alternatives: "",
          time: "",
          place: "",
          otherDisposition: "",
        };
        setAuthorization(initialAuthorization);
        setHistory(data.data.history);
        setLoading(false);
        try {
          const preview = await api.post<ArrayBuffer>(
            `${endpoint}/preview`,
            initialAuthorization,
            { responseType: "arraybuffer" },
          );
          await renderDocument(preview.data);
          if (active) setPreviewKey(JSON.stringify(initialAuthorization));
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

  function updateField<K extends keyof AuthorizationData>(
    key: K,
    value: AuthorizationData[K],
  ) {
    setAuthorization((current) =>
      current ? { ...current, [key]: value } : current,
    );
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
    if (!authorization) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<ArrayBuffer>(
        `${endpoint}/preview`,
        authorization,
        { responseType: "arraybuffer" },
      );
      await renderDocument(data);
      setPreviewKey(JSON.stringify(authorization));
      setNotice("Vista previa actualizada. Este paso no guarda ni registra la autorización.");
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function saveAndOpenPrintDialog(action: "print" | "pdf") {
    if (!authorization) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<ArrayBuffer>(
        `${endpoint}/document`,
        authorization,
        { responseType: "arraybuffer" },
      );
      await renderDocument(data);
      setPreviewKey(JSON.stringify(authorization));
      setNotice(
        "Autorización registrada como documento pendiente de firma. No se registra que el procedimiento se haya realizado.",
      );
      if (action === "pdf") {
        setNotice(
          "Elige “Guardar como PDF” en el diálogo de impresión para descargar el documento. La autorización queda pendiente de firma.",
        );
      }
      window.setTimeout(() => window.print(), 100);
    } catch (requestError: unknown) {
      setError(getRequestError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DocumentPreviewModal
      className="euthanasia-composer"
      labelledBy="euthanasia-composer-title"
      onClose={onClose}
    >
      <header className="document-modal-header no-print">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Plantilla oficial · Autorizacion_Eutanasia_Ayala.docx
          </p>
          <h2 className="mt-1 text-xl font-semibold text-primary" id="euthanasia-composer-title">
            Autorización de Eutanasia
          </h2>
          <p className="mt-1 text-sm text-muted">
            Revisa los datos. La decisión y las firmas quedan en blanco para completarse en el formato.
          </p>
        </div>
        <button
          aria-label="Cerrar autorización"
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
      ) : authorization ? (
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
              <TextField label="Propietario(a) / responsable" value={authorization.ownerName} onChange={(value) => updateField("ownerName", value)} />
              <TextField label="Teléfono" value={authorization.ownerPhone} onChange={(value) => updateField("ownerPhone", value)} />
              <TextField label="Nombre de la mascota" value={authorization.petName} onChange={(value) => updateField("petName", value)} />
              <TextField label="Especie" value={authorization.species} onChange={(value) => updateField("species", value)} />
              <TextField label="Raza" value={authorization.breed} onChange={(value) => updateField("breed", value)} />
              <TextField label="Edad" value={authorization.age} onChange={(value) => updateField("age", value)} />
              <TextField label="Sexo" value={authorization.sex} onChange={(value) => updateField("sex", value)} />
              <TextField label="Peso" value={authorization.weight} onChange={(value) => updateField("weight", value)} />
              <TextField label="Domicilio" value={authorization.address} onChange={(value) => updateField("address", value)} />
              <TextField label="Identificación / expediente" value={authorization.identification} onChange={(value) => updateField("identification", value)} />
            </section>

            <section className="euthanasia-form-section">
              <h3>Información para completar en la autorización</h3>
              <TextField label="Fecha de elaboración" type="date" value={authorization.documentDate} onChange={(value) => updateField("documentDate", value)} />
              <TextArea label="Diagnóstico / condición clínica" value={authorization.diagnosis} onChange={(value) => updateField("diagnosis", value)} />
              <TextArea label="Pronóstico y fundamento médico" value={authorization.prognosis} onChange={(value) => updateField("prognosis", value)} />
              <TextArea label="Alternativas explicadas" value={authorization.alternatives} onChange={(value) => updateField("alternatives", value)} />
              <TextField label="Hora (opcional)" type="time" value={authorization.time} onChange={(value) => updateField("time", value)} />
              <TextField label="Lugar (opcional)" value={authorization.place} onChange={(value) => updateField("place", value)} />
              <TextField label="Otra indicación sobre disposición (opcional)" value={authorization.otherDisposition} onChange={(value) => updateField("otherDisposition", value)} />
              <p className="text-xs leading-5 text-muted">
                El diagnóstico, pronóstico, alternativas, hora y lugar no se inventan ni se completan automáticamente.
                Las casillas de decisión y las líneas de firma permanecen vacías.
              </p>
            </section>

            {history.length > 0 && (
              <section className="euthanasia-history">
                <h3>Autorizaciones generadas para esta mascota</h3>
                {history.slice(0, 5).map((item) => (
                  <p key={item.id}>
                    {formatDateTime(item.generatedAt)} · {item.author.name}
                  </p>
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
                Imprimir autorización
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
                El formato Word oficial se conserva como plantilla.
              </p>
            </div>
          </form>

          <section className="recipe-preview-column euthanasia-preview-column" aria-label="Vista previa de autorización">
            <div className="recipe-preview-caption no-print">
              <h3>Vista previa del documento oficial</h3>
              <p>
                {previewIsCurrent
                  ? "Vista previa generada con la plantilla oficial."
                  : "Actualiza la vista previa para reflejar los últimos cambios."}
              </p>
            </div>
            <div className="recipe-docx-render euthanasia-docx-render" id="euthanasia-print-area">
              <div className="recipe-docx-styles" ref={stylesRef} />
              <div ref={documentRef} />
            </div>
          </section>
        </div>
      ) : null}
    </DocumentPreviewModal>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-primary">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        type={type}
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
        maxLength={5000}
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

function getLocalDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    return error.response?.data?.error ?? "No se pudo preparar la autorización.";
  }
  return "No se pudo preparar la autorización. Comprueba tu conexión e inténtalo de nuevo.";
}
