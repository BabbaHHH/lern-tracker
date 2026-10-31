import enginePackage from "pdfjs-dist/package.json";
export const PDF_TEXT_VERSION = `pdfjs-items-v1@${enginePackage.version}`;

export interface PdfIdentity { klausurId: string; documentId: string; documentVersionId: string }
export const PDF_DOWNLOAD_URL = "/api/catalog/pdf-download";
export interface PdfDescriptor extends PdfIdentity {
  contractVersion: 1; scope: "catalog"; role: string; title: string; sourceFilename: string;
  versionNumber: number; byteSize: number; pageCount: number | null; textStatus: string;
}
/** PDF page numbers are 1-based. Offsets are UTF-16 in pdfjs-items-v1 text. */
export interface PdfSearchTarget {
  pageNumber: number; quote?: string; occurrence?: number; start?: number; end?: number;
  textVersion?: string;
}
export interface PdfPageGeometry {
  documentVersionId: string; pageNumber: number; viewBox: number[]; rotation: number;
  width: number; height: number; scale: number; viewportTransform: number[];
}
export function pdfFileURL(identity: PdfIdentity, describe = false): string {
  const params = new URLSearchParams({ ...identity });
  if (describe) params.set("describe", "1");
  return `/api/catalog/pdf?${params}`;
}
export function pdfViewerURL(identity: PdfIdentity, target?: PdfSearchTarget): string {
  const params = new URLSearchParams({ ...identity });
  if (target) {
    params.set("page", String(target.pageNumber));
    if (target.quote) params.set("quote", target.quote);
    if (target.occurrence !== undefined) params.set("occurrence", String(target.occurrence));
    if (target.start !== undefined && target.end !== undefined && target.textVersion) {
      params.set("start", String(target.start)); params.set("end", String(target.end)); params.set("textVersion", target.textVersion);
    }
  }
  return `/konto/klausuren/pdf?${params}`;
}
