import enAccounts from "./locales/en/accounts.json";
import enCommon from "./locales/en/common.json";
import enMail from "./locales/en/mail.json";
import enSettings from "./locales/en/settings.json";
import ptBRAccounts from "./locales/pt-BR/accounts.json";
import ptBRCommon from "./locales/pt-BR/common.json";
import ptBRMail from "./locales/pt-BR/mail.json";
import ptBRSettings from "./locales/pt-BR/settings.json";

export const defaultNS = "common";

export const resources = {
  en: { common: enCommon, mail: enMail, accounts: enAccounts, settings: enSettings },
  "pt-BR": { common: ptBRCommon, mail: ptBRMail, accounts: ptBRAccounts, settings: ptBRSettings },
} as const;
