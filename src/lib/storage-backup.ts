/** Restore a validated set of storage entries, rolling back on quota/errors. */
export function restoreStorage(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  entries: [string, unknown][],
): number {
  const encoded = entries.map(([key, value]) => [key, JSON.stringify(value)] as const);
  const previous = new Map(encoded.map(([key]) => [key, storage.getItem(key)]));
  try {
    for (const [key, value] of encoded) storage.setItem(key, value);
  } catch {
    // Remove the partially imported values first, freeing their space for rollback.
    try {
      for (const [key] of encoded) storage.removeItem(key);
      for (const [key, value] of previous) if (value !== null) storage.setItem(key, value);
    } catch {
      throw new Error("Wiederherstellung fehlgeschlagen; auch das Zurücksetzen war nicht vollständig möglich. Bitte das vorhandene Backup aufbewahren.");
    }
    throw new Error("Backup passt nicht in den Browserspeicher oder der Speicher ist gesperrt. Die bisherigen Daten wurden wiederhergestellt.");
  }
  return entries.length;
}
