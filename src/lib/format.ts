import type { MailAddress } from "@models";
import { format, isThisWeek, isThisYear, isToday, isYesterday, type Locale } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";

const dateLocales: Record<string, Locale> = { en: enUS, "pt-BR": ptBR };

export function dateLocale(language: string): Locale {
  return dateLocales[language] ?? enUS;
}

/** Compact date for message lists: time today, weekday this week, date otherwise. */
export function formatListDate(date: Date, language: string, yesterdayLabel: string): string {
  const locale = dateLocale(language);
  if (isToday(date)) return format(date, "p", { locale });
  if (isYesterday(date)) return yesterdayLabel;
  if (isThisWeek(date)) return format(date, "EEEE", { locale });
  if (isThisYear(date)) return format(date, "d MMM", { locale });
  return format(date, "P", { locale });
}

export function formatFullDate(date: Date, language: string): string {
  return format(date, "PPPp", { locale: dateLocale(language) });
}

export function formatAddress({ name, address }: MailAddress): string {
  return name ? `${name} <${address}>` : address;
}

export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2);
  return (letters ?? "?").toUpperCase();
}
