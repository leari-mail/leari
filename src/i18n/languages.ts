import type { resources } from "./resources";

export type Language = keyof typeof resources;

/** Languages offered in settings, labeled in their own language. */
export const languages: Array<{ code: Language; label: string }> = [
  { code: "en", label: "English" },
  { code: "pt-BR", label: "Português (Brasil)" },
];

export const fallbackLanguage: Language = "en";
