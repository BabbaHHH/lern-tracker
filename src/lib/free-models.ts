// Lädt die kostenlosen OpenRouter-Modelle und cached sie pro KALENDERTAG im
// localStorage. So wird die Liste beim ersten Öffnen am Morgen frisch gesucht
// ("Token-Jäger"), danach den Tag über aus dem Cache bedient — ohne Backend/Cron.

export interface FreeModel {
  id: string;
  name: string;
  contextLength: number;
}

const CACHE_KEY = "lerntracker-free-models";

function todayStr(): string {
  // YYYY-MM-DD in lokaler Zeit (nicht UTC), damit "Morgen" zum Nutzertag passt.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CacheShape {
  day: string;
  models: FreeModel[];
}

/** Cached Liste lesen, falls von heute. Sonst null. */
export function getCachedFreeModels(): FreeModel[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CacheShape;
    if (cached.day === todayStr() && Array.isArray(cached.models)) return cached.models;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Liefert die kostenlosen Modelle. Nutzt den Tages-Cache, sonst frischer Fetch.
 * @param force  Cache ignorieren und neu suchen (z.B. Refresh-Button).
 */
export async function loadFreeModels(force = false): Promise<FreeModel[]> {
  if (typeof window === "undefined") return [];
  if (!force) {
    const cached = getCachedFreeModels();
    if (cached) return cached;
  }
  const res = await fetch("/api/openrouter-models", { cache: "no-store" });
  const json = (await res.json()) as { models?: FreeModel[]; error?: string };
  if (json.error) throw new Error(json.error);
  const models = json.models ?? [];
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ day: todayStr(), models } satisfies CacheShape));
  } catch {
    /* ignore quota */
  }
  return models;
}
