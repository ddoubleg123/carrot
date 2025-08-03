import all from "world-countries";

export type Country = { code: string; label: string };

export const countries: Country[] = all
  .map((c) => ({
    code: c.cca2,                         // "US"
    label: c.name.common,                 // "United States"
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export const findByCode = (code?: string | null) =>
  countries.find((c) => c.code === code) ?? null;
