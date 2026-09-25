import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { fallbackLanguage, languages, matchLanguage } from "./languages";
import { defaultNS, resources } from "./resources";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    ns: Object.keys(resources.en),
    fallbackLng: fallbackLanguage,
    // Explicit codes only: i18next 26 fails to resolve "pt-BR" with `nonExplicitSupportedLngs`.
    supportedLngs: languages.map((language) => language.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "leari.language",
      caches: ["localStorage"],
      convertDetectedLanguage: matchLanguage,
    },
  });

export { i18n };
export { fallbackLanguage, type Language, languages } from "./languages";
