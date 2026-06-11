const ZA_LOCALE = "en-ZA";
const ZA_TZ = "Africa/Johannesburg";

export function formatAdminDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(ZA_LOCALE, { timeZone: ZA_TZ, year: "numeric", month: "short", day: "numeric" });
}

export function formatAdminDatetime(value: string | Date): string {
  return new Date(value).toLocaleString(ZA_LOCALE, {
    timeZone: ZA_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAdminTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(ZA_LOCALE, { timeZone: ZA_TZ, hour: "2-digit", minute: "2-digit" });
}
