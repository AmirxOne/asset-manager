export * from "./fa";
export * from "./jalali";
export * from "./person-name";
export { tzOffsetMinutes } from "./jalali";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO date (YYYY-MM-DD) of a Date in a timezone — no library. */
export function isoDateInTz(date: Date, tz = "Asia/Tehran"): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(date);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}
