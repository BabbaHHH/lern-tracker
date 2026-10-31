/** Stable across navigation ranges, including schedules without a start date. */
export function frequencyMatches(frequency: string | undefined, date: Date, startDate?: string): boolean {
  if (["unregelmäßig", "selten"].includes(frequency ?? "")) return false;
  const week = (value: Date) => Math.floor((value.getTime() - Date.UTC(1970, 0, 5)) / (7 * 86400000));
  const offset = week(date) - (startDate ? week(new Date(startDate + "T00:00:00Z")) : 0);
  if (["14-tägig", "alle 2 Wochen", "zweiwöchentlich"].includes(frequency ?? "")) return offset % 2 === 0;
  if (frequency === "monatlich") return offset % 4 === 0;
  return true;
}
