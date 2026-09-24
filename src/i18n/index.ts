import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { fallbackLanguage, languages } from "./languages";
import { defaultNS, resources } from "./resources";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    ns: Object.keys(resources.en),
    fallbackLng: fallbackLanguage,
    supportedLngs: languages.map((language) => language.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "leari.language",
      caches: ["localStorage"],
    },
  });

export { i18n };
export { fallbackLanguage, languages, type Language } from "./languages";
