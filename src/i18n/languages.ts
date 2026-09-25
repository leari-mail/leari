import type { resources } from "./resources";

export type Language = keyof typeof resources;

/** Languages offered in settings, labeled in their own language. */
export const languages: Array<{ code: Language; label: string }> = [
  { code: "en", label: "English" },
  { code: "pt-BR", label: "Português (Brasil)" },
];

export const fallbackLanguage: Language = "en";

/** Maps a detected locale (e.g. "pt", "pt-PT", "en-GB") to the closest supported language. */
export function matchLanguage(detected: string): Language {
  const exact = languages.find(
    (language) => language.code.toLowerCase() === detected.toLowerCase(),
  );
  if (exact) return exact.code;
  const base = detected.split("-")[0].toLowerCase();
  return (
    languages.find((language) => language.code.split("-")[0] === base)?.code ?? fallbackLanguage
  );
}
