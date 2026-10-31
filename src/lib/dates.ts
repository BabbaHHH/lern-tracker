import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

/** Calendar dates stay in the user's local day; timestamps remain UTC. */
export function currentDate(): Date {
  const reference = process.env.STEX_REFERENCE_DATE;
  return process.env.NODE_ENV !== "production" && reference && isDateOnly(reference)
    ? parseISO(`${reference}T12:00:00`) : new Date();
}

export function testReferenceDate(): string | null {
  const reference = process.env.STEX_REFERENCE_DATE;
  return process.env.NODE_ENV !== "production" && reference && isDateOnly(reference) ? reference : null;
}

export function localDate(date = currentDate()): string {
  return format(date, "yyyy-MM-dd");
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}

export function examCountdown(examDate: string, startDate: string, now = currentDate()) {
  if (!isDateOnly(examDate)) return null;
  const exam = parseISO(examDate);
  const days = differenceInCalendarDays(exam, now);
  const total = isDateOnly(startDate) ? differenceInCalendarDays(exam, parseISO(startDate)) : 0;
  const progress = total > 0 ? Math.max(0, Math.min(100, Math.round((total - days) / total * 100))) : 0;
  return { days: Math.max(0, days), weeks: Math.max(0, Math.floor(days / 7)), passed: days < 0, progress };
}
