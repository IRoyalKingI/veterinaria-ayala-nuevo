import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import type { z } from "zod";
import type { clinicalAnalysisDocumentDataSchema } from "../routes/clinical.schemas";

export type ClinicalAnalysisDocumentData = z.infer<
  typeof clinicalAnalysisDocumentDataSchema
>;

const templateRelativePath = [
  "Documentos",
  "Plantillas",
  "FORMATO ANALISIS CLINICOS.docx",
];

// Repopulate the verified official ranges in the generated copy when source cells are blank.
const hemogramReferences = [
  "5.5–8.5",
  "37–55",
  "12–18",
  "60–72",
  "19.5–25.5",
  "32–38.5",
  "6–17",
  "0.9–5.0",
  "0.3–1.5",
  "0.1–1.5",
  "3.5–12.0",
  "200–500",
];

const hepaticReferences = [
  "4–70",
  "12–55",
  "6–189",
  "16–73",
  "0.0–5.0",
  "0–5",
  "19–120",
  "135–278",
  "5.4–7.5",
  "29–40",
];

export async function generateClinicalAnalysisDocument(
  data: ClinicalAnalysisDocumentData,
): Promise<Buffer> {
  const zip = new PizZip(await readClinicalAnalysisTemplate());
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("La plantilla oficial no contiene word/document.xml.");
  }

  let xml = document.asText();

  xml = updateTable(xml, "Número de expediente", (rows) => {
    assertRowCount(rows, 4, "datos del propietario");
    setCell(rows, 0, 1, data.ownerName);
    setCell(rows, 1, 1, data.ownerAddress);
    setCell(rows, 2, 1, data.ownerPhone);
    setCell(rows, 3, 1, data.recordNumber);
  });

  xml = updateTable(xml, "Especie", (rows) => {
    assertRowCount(rows, 3, "identificación del paciente");
    setCell(rows, 0, 1, data.petName);
    setCell(rows, 0, 3, data.species);
    setCell(rows, 1, 1, data.breed);
    setCell(rows, 1, 3, data.sex);
    setCell(rows, 2, 1, data.age);
    setCell(rows, 2, 3, data.weight);
  });

  xml = updateTable(xml, "RBC x10", (rows) => {
    assertRowCount(rows, 13, "hemograma");
    data.hemogramResults.forEach((value, index) => {
      setCell(rows, index + 1, 1, value);
      setCell(rows, index + 1, 2, hemogramReferences[index]);
    });
  });

  xml = updateTable(xml, "Proteínas totales", (rows) => {
    assertRowCount(rows, 4, "proteínas, hemoparásitos y observaciones");
    const proteinReference = cellText(getCells(rows[0])[1])
      .split("|")
      .slice(1)
      .join("|")
      .trim() || "Valor de referencia: 5,3–7,1 mg/dL";
    setCell(
      rows,
      0,
      1,
      [
        data.proteinResult.trim()
          ? `${data.proteinResult.trim().replace(/\s*mg\/dL$/i, "")} mg/dL`
          : "",
        proteinReference,
      ]
        .filter(Boolean)
        .join("  |  "),
    );
    setCell(rows, 1, 1, data.hemoparasites);
    setCell(rows, 2, 1, data.knottMethod);
    setCell(rows, 3, 1, data.observations);
  });

  xml = updateTable(xml, "ANALITO", (rows) => {
    assertRowCount(rows, 11, "perfil hepático");
    data.hepaticProfileResults.forEach((value, index) =>
      setCell(rows, index + 1, 1, value),
    );
    hepaticReferences.forEach((reference, index) =>
      setCell(rows, index + 1, 3, reference),
    );
  });

  xml = replaceParagraphValue(xml, "Función zoo-técnica:", data.zoottechnicalFunction);

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function readClinicalAnalysisTemplate(): Promise<Buffer> {
  const candidates = [
    resolve(process.cwd(), ...templateRelativePath),
    resolve(process.cwd(), "..", ...templateRelativePath),
    resolve(__dirname, "..", "..", "..", ...templateRelativePath),
    resolve(__dirname, "..", "..", "..", "..", ...templateRelativePath),
  ];

  for (const candidate of new Set(candidates)) {
    try {
      await access(candidate, constants.R_OK);
      return await readFile(candidate);
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
  }

  throw new Error(
    `No se encontró la plantilla oficial: ${templateRelativePath.join("\\")}.`,
  );
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function updateTable(
  xml: string,
  marker: string,
  update: (rows: string[]) => void,
): string {
  let updated = false;
  const result = xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, (table) => {
    if (updated || !tableText(table).includes(marker)) return table;
    updated = true;
    const rows = [...table.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(
      (match) => match[0],
    );
    update(rows);
    let rowIndex = 0;
    return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, () => rows[rowIndex++]);
  });

  if (!updated) {
    throw new Error(`No se encontró la sección "${marker}" en la plantilla oficial.`);
  }
  return result;
}

function assertRowCount(rows: string[], expected: number, section: string): void {
  if (rows.length !== expected) {
    throw new Error(
      `La sección "${section}" de la plantilla no tiene la estructura esperada.`,
    );
  }
}

function getCells(row: string): string[] {
  return [...row.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(
    (match) => match[0],
  );
}

function setCell(rows: string[], rowIndex: number, cellIndex: number, value: string): void {
  const row = rows[rowIndex];
  if (!row) throw new Error("No se encontró una fila esperada en la plantilla.");
  const cells = getCells(row);
  const target = cells[cellIndex];
  if (!target) throw new Error("No se encontró una celda esperada en la plantilla.");
  cells[cellIndex] = replaceCellText(target, value);
  let cellIndexToReplace = 0;
  rows[rowIndex] = row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, () =>
    cells[cellIndexToReplace++],
  );
}

function replaceCellText(cell: string, value: string): string {
  let replacedFirst = false;
  const result = cell.replace(
    /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
    (_match, opening: string, text: string, closing: string) => {
      if (replacedFirst) return `${opening}${closing}`;
      replacedFirst = true;
      return `${opening}${escapeXmlText(value)}${closing}`;
    },
  );
  if (replacedFirst || !value.trim()) return result;

  const newRun = `<w:r><w:t xml:space="preserve">${escapeXmlText(value)}</w:t></w:r>`;
  let inserted = false;
  const cellWithValue = cell.replace(
    /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/,
    (_match, opening: string, content: string, closing: string) => {
      inserted = true;
      return `${opening}${content}${newRun}${closing}`;
    },
  );
  if (!inserted) {
    throw new Error("No se pudo completar una celda de la plantilla oficial.");
  }
  return cellWithValue;
}

function replaceParagraphValue(xml: string, marker: string, value: string): string {
  let replaced = false;
  const result = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced || !paragraphText(paragraph).includes(marker)) return paragraph;
    replaced = true;
    const textNodes = [...paragraph.matchAll(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g)];
    const fullText = textNodes.map((match) => decodeXmlText(match[2])).join("");
    const labelEnd = fullText.indexOf(marker) + marker.length;
    let consumed = 0;
    let valuePlaced = false;
    return paragraph.replace(
      /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
      (_match, opening: string, encodedText: string, closing: string) => {
        const text = decodeXmlText(encodedText);
        const keepLength = Math.max(0, Math.min(text.length, labelEnd - consumed));
        const keptText = text.slice(0, keepLength);
        consumed += text.length;
        const appendValue =
          !valuePlaced && consumed >= labelEnd && value.trim()
            ? `${keptText.endsWith(" ") ? "" : " "}${value.trim()}`
            : "";
        if (appendValue) valuePlaced = true;
        return `${opening}${escapeXmlText(keptText + appendValue)}${closing}`;
      },
    );
  });

  if (!replaced) {
    throw new Error(`No se encontró el campo "${marker}" en la plantilla oficial.`);
  }
  return result;
}

function tableText(table: string): string {
  return [...table.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
}

function paragraphText(paragraph: string): string {
  return tableText(paragraph);
}

function cellText(cell: string): string {
  return tableText(cell);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\r\n]+/g, " ");
}
