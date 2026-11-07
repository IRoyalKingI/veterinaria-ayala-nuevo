export const vacunasPorEspecie = {
  Perro: [
    "Vacuna antirrábica",
    "Vacuna polivalente (DHPPiL)",
    "Vacuna contra leptospira",
    "Vacuna contra parvovirus",
    "Vacuna contra moquillo",
    "Vacuna contra tos de las perreras",
    "Vacuna contra coronavirus",
  ],
  Gato: [
    "Vacuna antirrábica",
    "Vacuna trivalente felina (FRCP)",
    "Vacuna contra leucemia felina",
    "Vacuna contra panleucopenia",
    "Vacuna contra calicivirus",
    "Vacuna contra rinotraqueitis",
    "Vacuna contra clamidia",
  ],
} as const;

export type EspecieMascota = keyof typeof vacunasPorEspecie;

export function getVacunasPorEspecie(species?: string | null): readonly string[] {
  const normalized = normalizeSpecies(species);
  if (!normalized) return [];
  return vacunasPorEspecie[normalized] ?? [];
}

export function normalizeSpecies(species?: string | null): EspecieMascota | null {
  const normalized = (species ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (normalized.includes("perro") || normalized.includes("dog")) return "Perro";
  if (normalized.includes("gato") || normalized.includes("cat")) return "Gato";
  return null;
}
