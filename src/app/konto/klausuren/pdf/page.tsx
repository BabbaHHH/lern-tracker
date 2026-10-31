import { CatalogPdfViewer } from "@/components/catalog-pdf-viewer";
import { PDF_TEXT_VERSION, type PdfSearchTarget } from "@/lib/pdf-viewer/contract";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const single = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const page = Number(single("page"));
  const identity = { klausurId: single("klausurId"), documentId: single("documentId"), documentVersionId: single("documentVersionId") };
  const target: PdfSearchTarget = { pageNumber: Number.isSafeInteger(page) && page > 0 ? page : 1,
    quote: single("quote").slice(0, 2000), occurrence: Number(single("occurrence") || 0),
    start: single("start") ? Number(single("start")) : undefined, end: single("end") ? Number(single("end")) : undefined,
    textVersion: single("textVersion") === PDF_TEXT_VERSION ? PDF_TEXT_VERSION : undefined };
  return <CatalogPdfViewer key={JSON.stringify([identity, target])} identity={identity} initialTarget={target} />;
}
