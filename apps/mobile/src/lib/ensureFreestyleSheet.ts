import { api } from "../api/client";

export const FREESTYLE_SHEET_NAME = "Freestyle";

/** Jeden ukryty „plan” na użytkownika — trzyma ćwiczenia z sesji freestyle. */
export async function ensureFreestyleSheet(): Promise<{ sheetId: string }> {
  const sheets = await api.sheets.list();
  const key = FREESTYLE_SHEET_NAME.toLocaleUpperCase("pl-PL");
  const existing = sheets.find(
    (sheet) => sheet.name.trim().toLocaleUpperCase("pl-PL") === key,
  );

  if (existing) {
    return { sheetId: existing.id };
  }

  const created = await api.sheets.create({
    name: FREESTYLE_SHEET_NAME,
    description: "Freestyle — wybieraj ćwiczenia w trakcie sesji.",
  });

  return { sheetId: created.id };
}
