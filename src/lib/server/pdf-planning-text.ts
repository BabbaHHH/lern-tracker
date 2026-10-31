const MAX_PAGES = 100;
const MAX_TEXT_ANNOTATIONS = 1000;
// PDF annotation flags: Invisible, Hidden, NoView. AnnotationFlag is not
// exported by PDF.js's public display module.
const HIDDEN_TEXT_FLAGS = 0x01 | 0x02 | 0x20;

export interface PdfTextAnnotationSource {
  sourceDocument: string;
  page: number;
  id: string;
  rect: number[];
  status: "included" | "already-in-page" | "duplicate" | "unreadable";
}

export interface PdfPlanningText {
  text: string;
  incomplete: boolean;
  totalPages: number;
  parsedPages: number;
  textAnnotations: PdfTextAnnotationSource[];
  warnings: string[];
}

interface TextAnnotation {
  subtype?: string;
  annotationFlags?: number;
  rect?: number[];
  id?: string;
  contentsObj?: { str?: string };
}

const comparable = (text: string) => text.normalize("NFKC").replace(/\u00ad/g, "").replace(/\s+/g, " ").replace(/ \| /g, " ").trim();

/** Keep pdf-parse's table layout, adding visible FreeText via PDF.js's public API.
 * Both parsers use the already installed pdfjs-dist engine; no private PDFParse
 * fields, external services, annotation actions or uploaded HTML are executed. */
export async function extractPdfPlanningText(data: Buffer, filename: string): Promise<PdfPlanningText> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data, isEvalSupported: false });
  const base = await (async () => {
    try { return await parser.getText({ first: MAX_PAGES, cellSeparator: " | " }); }
    finally { await parser.destroy(); }
  })();
  const result: PdfPlanningText = {
    text: "", incomplete: base.total > MAX_PAGES, totalPages: base.total,
    parsedPages: base.pages.length, textAnnotations: [], warnings: [],
  };
  if (result.incomplete) result.warnings.push(`Nur die ersten ${MAX_PAGES} von ${base.total} PDF-Seiten wurden ausgewertet.`);
  const blocks: string[] = [];
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copy bytes: PDF.js may transfer ownership of the underlying buffer.
  const loading = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, verbosity: pdfjs.VerbosityLevel.ERRORS });
  try {
    const document = await loading.promise;
    let annotationLimitReached = false;
    for (const extracted of base.pages) {
      blocks.push(extracted.text);
      try {
        const page = await document.getPage(extracted.num);
        try {
          const annotations: TextAnnotation[] = await page.getAnnotations({ intent: "display" });
          const seen = new Set<string>();
          const pageText = comparable(extracted.text);
          let number = 0;
          for (const annotation of annotations) {
            if (annotation.subtype !== "FreeText") continue;
            if ((annotation.annotationFlags ?? 0) & HIDDEN_TEXT_FLAGS) continue;
            const rect = annotation.rect;
            const [left, bottom, right, top] = page.view;
            if (!rect || rect.length !== 4 || !rect.every(Number.isFinite)
              || rect[2] <= rect[0] || rect[3] <= rect[1]
              || rect[2] <= left || rect[0] >= right || rect[3] <= bottom || rect[1] >= top) continue;
            if (result.textAnnotations.length >= MAX_TEXT_ANNOTATIONS) {
              annotationLimitReached = true;
              continue;
            }
            number++;
            const text = annotation.contentsObj?.str?.trim() ?? "";
            const key = comparable(text);
            const status = !key ? "unreadable" : pageText.includes(key) ? "already-in-page" : seen.has(key) ? "duplicate" : "included";
            result.textAnnotations.push({ sourceDocument: filename, page: extracted.num, id: annotation.id ?? `text-${number}`, rect: [...rect], status });
            if (status === "unreadable") {
              result.incomplete = true;
              result.warnings.push(`Seite ${extracted.num}: Textanmerkung ${number} hat keinen lesbaren einfachen Text und wurde nicht übernommen.`);
            } else if (status === "included") {
              blocks.push(`[Quelle: ${JSON.stringify(filename)} | Seite ${extracted.num} | Textanmerkung ${number}]\n${text}`);
              seen.add(key);
            }
          }
        } finally { page.cleanup(); }
      } catch {
        result.incomplete = true;
        result.warnings.push(`Seite ${extracted.num}: Textanmerkungen konnten nicht vollständig gelesen werden; der Seitentext ist weiterhin enthalten.`);
      }
      blocks.push(`-- ${extracted.num} of ${base.total} --`);
    }
    if (annotationLimitReached) {
      result.incomplete = true;
      result.warnings.push(`Es wurden höchstens ${MAX_TEXT_ANNOTATIONS} sichtbare Textanmerkungen ausgewertet; weitere wurden ausgelassen.`);
    }
  } catch {
    result.incomplete = true;
    result.warnings.push("PDF-Textanmerkungen konnten nicht gelesen werden; nur der maschinenlesbare Seitentext ist verfügbar.");
    // A loading failure happens before any page text has been assembled.
    if (!blocks.length) blocks.push(base.text);
  } finally { await loading.destroy(); }
  result.text = blocks.join("\n\n");
  return result;
}
