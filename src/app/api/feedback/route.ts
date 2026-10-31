import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateFeedback } from "@/lib/feedback";
import { errorResponse, limitRequests, readJson, RequestError, requireLocalAccess } from "@/lib/server/request-safety";

export const runtime = "nodejs";
const directory = () => path.join(process.cwd(), "private-data", "feedback");
export async function POST(request: Request) {
  try {
    requireLocalAccess(request); limitRequests("feedback-write", 15);
    const feedback = validateFeedback(await readJson(request, 24000));
    if (!feedback) throw new RequestError("Bitte Kategorie und einen Text mit 5 bis 4000 Zeichen angeben.");
    await mkdir(directory(), { recursive: true, mode: 0o700 });
    const file = path.join(directory(), `${feedback.id}.json`);
    const content = JSON.stringify(feedback, null, 2);
    try {
      if ((await readdir(directory())).length >= 1000) throw new RequestError("Der Feedbackspeicher ist voll. Bitte Feedback als Datei sichern.", 507);
      await writeFile(file, content, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await readFile(file, "utf8") !== content) throw new RequestError("Diese Feedbackkennung wurde bereits verwendet. Bitte das Formular erneut öffnen.", 409);
    }
    return Response.json({ id: feedback.id, saved: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function GET(request: Request) {
  try {
    requireLocalAccess(request); limitRequests("feedback-read", 20);
    // The local owner's inbox is never exposed on an explicitly allowed LAN URL.
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) throw new RequestError("Die Feedbackübersicht ist nur direkt auf dem lokalen Rechner verfügbar.", 403);
    let names: string[];
    try { names = await readdir(directory()); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; names = []; }
    const records = await Promise.all(names.filter(name => /^[0-9a-f-]{36}\.json$/i.test(name)).slice(0, 1000).map(async name => {
      try { return validateFeedback(JSON.parse(await readFile(path.join(directory(), name), "utf8"))); } catch { return null; }
    }));
    return Response.json({ feedback: records.filter(item => item !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
