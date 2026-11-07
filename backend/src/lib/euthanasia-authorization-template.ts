import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import type { z } from "zod";
import type { euthanasiaAuthorizationDataSchema } from "../routes/clinical.schemas";

export type EuthanasiaAuthorizationData = z.infer<
  typeof euthanasiaAuthorizationDataSchema
>;

const templateRelativePath = [
  "Documentos",
  "Plantillas",
  "Autorizacion_Eutanasia_Ayala.docx",
];

export async function generateEuthanasiaAuthorizationDocument(
  data: EuthanasiaAuthorizationData,
): Promise<Buffer> {
  const zip = new PizZip(await readAuthorizationTemplate());
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("La plantilla oficial no contiene word/document.xml.");
  }

  let xml = document.asText();
  xml = replaceCellFields(xml, "Propietario(a) / responsable:", [data.ownerName]);
  xml = replaceCellFields(xml, "Teléfono:", [data.ownerPhone]);
  xml = replaceCellFields(xml, "Nombre de la mascota:", [data.petName]);
  xml = replaceCellFields(xml, "Especie:", [data.species, data.breed]);
  xml = replaceCellFields(xml, "Edad:", [data.age, data.sex]);
  xml = replaceCellFields(xml, "Peso:", [data.weight]);
  xml = replaceCellFields(xml, "Domicilio:", [data.address]);
  xml = replaceCellFields(xml, "Identificación/expediente:", [data.identification]);
  xml = replaceCellFields(xml, "Diagnóstico / condición clínica:", [data.diagnosis]);
  xml = replaceCellFields(xml, "Pronóstico y fundamento médico:", [data.prognosis]);
  xml = replaceCellFields(xml, "Alternativas explicadas (", [data.alternatives]);
  xml = replaceCellFields(xml, "Fecha:", [
    ...formatDateParts(data.documentDate),
    data.time,
  ]);
  xml = replaceCellFields(xml, "Lugar:", [data.place]);
  xml = replaceParagraphFields(xml, "Otra indicación:", [data.otherDisposition]);

  zip.file("word/document.xml", xml);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function readAuthorizationTemplate(): Promise<Buffer> {
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

function replaceCellFields(xml: string, label: string, values: string[]): string {
  return replaceFields(xml, /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g, label, values);
}

function replaceParagraphFields(xml: string, label: string, values: string[]): string {
  return replaceFields(xml, /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, label, values);
}

function replaceFields(
  xml: string,
  elementPattern: RegExp,
  label: string,
  values: string[],
): string {
  let replaced = false;
  const result = xml.replace(elementPattern, (element) => {
    if (replaced || !cellText(element).includes(label)) return element;
    replaced = true;
    let valueIndex = 0;
    return element.replace(
      /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
      (_match, opening: string, encodedText: string, closing: string) => {
        const text = encodedText.replace(/_{3,}/g, (blank) => {
          const value = values[valueIndex++]?.trim() ?? "";
          return value ? escapeXmlText(value) : blank;
        });
        return `${opening}${text}${closing}`;
      },
    );
  });

  if (!replaced) {
    throw new Error(`No se encontró el campo "${label}" en la plantilla oficial.`);
  }
  return result;
}

function cellText(cell: string): string {
  return [...cell.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("");
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

function formatDateParts(value: string): [string, string, string] {
  const [year, month, day] = value.split("-");
  return [day, month, year];
}
