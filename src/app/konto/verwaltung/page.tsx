import { headers } from "next/headers";
import Link from "next/link";
import { accountRuntime } from "@/lib/server/auth/runtime";
import { AdminOverview } from "@/components/admin-overview";
export const dynamic = "force-dynamic";
export default async function VerwaltungPage() {
  try { await (await accountRuntime()).principal(await headers(), "admin"); }
  catch { return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-semibold">Verwaltung</h1><p className="my-4">Dieser Bereich benötigt einen aktiven Adminzugang mit Authenticator. In dieser Umgebung muss der Kontobetrieb eingerichtet sein.</p><Link className="underline" href="/konto/anmelden">Zum Kontozugang</Link></main>; }
  return <AdminOverview />;
}
