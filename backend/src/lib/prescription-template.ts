import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import type { z } from "zod";
import type { prescriptionDataSchema } from "../routes/clinical.schemas";

export type PrescriptionData = z.infer<typeof prescriptionDataSchema>;

const templateRelativePath = ["Documentos", "Plantillas", "RECETARIO NUEVO 2026.docx"];
const templateDirectory = __dirname;

export async function generatePrescriptionDocument(
  data: PrescriptionData,
): Promise<Buffer> {
  const zip = new PizZip(await readPrescriptionTemplate());
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("La plantilla oficial no contiene word/document.xml.");
  }

  let xml = document.asText();
  xml = replaceParagraphContaining(
    xml,
    "FECHA:",
    `FECHA: ${formatPrescriptionDate(data.date)}.`,
  );
  xml = replaceParagraphAfterHeading(
    xml,
    "DIAGNÓSTICO / MOTIVO DE CONSULTA",
    data.diagnosis,
  );
  xml = replaceParagraphAfterHeading(
    xml,
    "RECOMENDACIONES / CUIDADOS EN CASA",
    data.recommendations,
  );

  xml = replaceTable(xml, "PROPIETARIO:", (rows) => {
    setCell(rows, 0, 1, data.ownerName);
    setCell(rows, 0, 3, data.ownerPhone);
    setCell(rows, 1, 1, data.petName);
    setCell(rows, 1, 3, data.species);
    setCell(rows, 2, 1, data.breed);
    setCell(rows, 2, 3, [data.sex, data.age, data.weight].filter(Boolean).join(" / "));
  });

  xml = replaceTable(xml, "Medicamento / presentación", (rows) => {
    if (rows.length !== 6) {
      throw new Error("La tabla de medicamentos de la plantilla no tiene cinco espacios.");
    }

    for (let index = 0; index < 5; index += 1) {
      const medication = data.medications[index];
      setCell(rows, index + 1, 1, medication?.name ?? "");
      setCell(rows, index + 1, 2, medication?.dosageFrequency ?? "");
      setCell(rows, index + 1, 3, medication?.durationInstructions ?? "");
    }
  });

  if (data.veterinarianName.trim()) {
    xml = replaceTable(xml, "FIRMA Y SELLO", (rows) => {
      setCellContent(
        rows,
        0,
        1,
        `Dr/a. ${data.veterinarianName}\n_______________________________FIRMA Y SELLO`,
      );
    });
  }

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function readPrescriptionTemplate(): Promise<Buffer> {
  const candidates = [
    resolve(process.cwd(), ...templateRelativePath),
    resolve(process.cwd(), "..", ...templateRelativePath),
    resolve(templateDirectory, "..", "..", "..", ...templateRelativePath),
    resolve(templateDirectory, "..", "..", "..", "..", ...templateRelativePath),
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

function replaceParagraphContaining(xml: string, marker: string, value: string): string {
  let replaced = false;
  const result = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (replaced || !paragraphText(paragraph).includes(marker)) return paragraph;
    replaced = true;
    return setParagraphText(paragraph, value);
  });
  if (!replaced) throw new Error(`No se encontró el campo "${marker}" en la plantilla.`);
  return result;
}

function replaceParagraphAfterHeading(
  xml: string,
  heading: string,
  value: string,
): string {
  let headingFound = false;
  let replaced = false;
  const result = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!headingFound) {
      if (paragraphText(paragraph).includes(heading)) headingFound = true;
      return paragraph;
    }
    if (replaced) return paragraph;
    replaced = true;
    return setParagraphText(paragraph, value);
  });
  if (!headingFound || !replaced) {
    throw new Error(`No se encontró el espacio para "${heading}" en la plantilla.`);
  }
  return result;
}

function replaceTable(
  xml: string,
  marker: string,
  update: (rows: string[]) => void,
): string {
  let replaced = false;
  const result = xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, (table) => {
    if (replaced || !paragraphText(table).includes(marker)) return table;
    const rows = table.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g);
    if (!rows) throw new Error(`La tabla "${marker}" no tiene filas.`);
    const mutableRows = [...rows];
    update(mutableRows);
    let rowIndex = 0;
    replaced = true;
    return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, () => mutableRows[rowIndex++]);
  });
  if (!replaced) throw new Error(`No se encontró la tabla "${marker}" en la plantilla.`);
  return result;
}

function setCell(rows: string[], rowIndex: number, cellIndex: number, value: string): void {
  const row = rows[rowIndex];
  if (!row) throw new Error("La plantilla oficial no contiene la fila esperada.");
  const cells = row.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g);
  const cell = cells?.[cellIndex];
  if (!cells || !cell) throw new Error("La plantilla oficial no contiene la celda esperada.");

  const currentText = paragraphText(cell).trim();
  if (currentText) {
    throw new Error("Se encontró contenido inesperado en un campo de la plantilla oficial.");
  }

  let rowCellIndex = 0;
  rows[rowIndex] = row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, (candidate) => {
    const index = rowCellIndex++;
    return index === cellIndex ? setCellText(candidate, value) : candidate;
  });
}

function setCellContent(
  rows: string[],
  rowIndex: number,
  cellIndex: number,
  value: string,
): void {
  const row = rows[rowIndex];
  if (!row) throw new Error("La plantilla oficial no contiene la fila esperada.");
  let currentCellIndex = 0;
  rows[rowIndex] = row.replace(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, (cell) => {
    const index = currentCellIndex++;
    return index === cellIndex ? setCellText(cell, value) : cell;
  });
  if (currentCellIndex <= cellIndex) {
    throw new Error("La plantilla oficial no contiene la celda esperada.");
  }
}

function setCellText(cell: string, value: string): string {
  return replaceTextNodeContent(cell, value);
}

function setParagraphText(paragraph: string, value: string): string {
  return replaceTextNodeContent(paragraph, value);
}

function replaceTextNodeContent(xml: string, value: string): string {
  let textNodeFound = false;
  const updated = xml.replace(
    /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,
    (_match, open: string, close: string) => {
      if (textNodeFound) return `${open}${close}`;
      textNodeFound = true;
      return value
        .split(/\r?\n/)
        .map((line, index) => `${index ? "<w:br/>" : ""}${open}${escapeXml(line)}${close}`)
        .join("");
    },
  );
  if (textNodeFound || !value) return updated;
  const textRun = `<w:r>${value
    .split(/\r?\n/)
    .map(
      (line, index) =>
        `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`,
    )
    .join("")}</w:r>`;
  const paragraphEnd = updated.lastIndexOf("</w:p>");
  if (paragraphEnd < 0) {
    throw new Error("No se encontró el párrafo de destino en la plantilla oficial.");
  }
  return `${updated.slice(0, paragraphEnd)}${textRun}${updated.slice(paragraphEnd)}`;
}

function paragraphText(xml: string): string {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function formatPrescriptionDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const monthNames = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
  ];
  return `${day}/ ${monthNames[month - 1]}/ ${year}`;
}
