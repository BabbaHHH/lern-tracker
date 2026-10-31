"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { PDF_DOWNLOAD_URL, PDF_TEXT_VERSION, pdfFileURL, type PdfDescriptor, type PdfIdentity, type PdfSearchTarget, type PdfPageGeometry } from "@/lib/pdf-viewer/contract";
import { pdfRenderWindow, pdfSearchTargetForPage, visiblePdfPage, type VisiblePdfPage } from "@/lib/pdf-viewer/scroll";
import enginePackage from "pdfjs-dist/package.json";
import { findQuote, pageText } from "@/lib/pdf-viewer/text";
import "pdfjs-dist/web/pdf_viewer.css";
import "./catalog-pdf-viewer.css";

type Engine = typeof import("pdfjs-dist");
type PageSize = { width: number; height: number };

async function description(identity: PdfIdentity, signal?: AbortSignal): Promise<PdfDescriptor> {
  const response = await fetch(pdfFileURL(identity, true), { cache: "no-store", credentials: "same-origin", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Das Dokument ist nicht verfügbar.");
  return data;
}

function selectInterval(divs: HTMLElement[], positions: { start: number; end: number }[], interval: { start: number; end: number }) {
  const first = positions.findIndex(position => position.end > interval.start && position.start <= interval.start);
  const last = positions.findIndex(position => position.end >= interval.end && position.start < interval.end);
  const startNode = divs[first]?.firstChild, endNode = divs[last]?.firstChild;
  if (!startNode || !endNode || !divs[first].isConnected || !divs[last].isConnected) return false;
  const range = document.createRange();
  range.setStart(startNode, interval.start - positions[first].start);
  range.setEnd(endNode, interval.end - positions[last].start);
  const selection = window.getSelection();
  selection?.removeAllRanges(); selection?.addRange(range);
  divs[first].scrollIntoView({ block: "center", inline: "nearest" });
  return true;
}

const CatalogPdfPage = memo(function CatalogPdfPage({
  pdf, engine, identity, pageNumber, active, width, zoom, rotation, getSearchTarget, estimatedWidth, estimatedHeight, registerPage, onPageSize,
}: {
  pdf: PDFDocumentProxy;
  engine: Engine | null;
  identity: PdfIdentity;
  pageNumber: number;
  active: boolean;
  width: number;
  zoom: number;
  rotation: number;
  getSearchTarget: () => PdfSearchTarget | null;
  estimatedWidth: number;
  estimatedHeight: number;
  registerPage: (pageNumber: number, element: HTMLElement | null) => void;
  onPageSize: (pageNumber: number, size: PageSize) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const register = useCallback((element: HTMLElement | null) => registerPage(pageNumber, element), [pageNumber, registerPage]);

  useEffect(() => {
    if (!active || !host.current || !engine) return;
    let disposed = false;
    const controller = new AbortController();
    let renderTask: RenderTask | undefined;
    let layer: TextLayer | undefined;
    const element = host.current;
    element.replaceChildren();
    setLoading(true); setError(""); setNotice("");
    void (async () => {
      // Each page is reauthorized immediately before it is rendered, including
      // pages backed by bytes PDF.js has already buffered.
      await description(identity, controller.signal);
      const page = await pdf.getPage(pageNumber);
      if (disposed) return;
      const totalRotation = (page.rotate + rotation) % 360;
      const base = page.getViewport({ scale: 1, rotation: totalRotation });
      const scale = Math.min(width / base.width, 1.6) * zoom;
      const viewport = page.getViewport({ scale, rotation: totalRotation });
      onPageSize(pageNumber, { width: base.width, height: base.height });
      element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`;
      element.style.setProperty("--scale-factor", String(scale));
      element.style.setProperty("--total-scale-factor", String(scale));
      element.dataset.rotation = String(totalRotation);
      const canvas = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2, 16384 / viewport.width, 16384 / viewport.height, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      if (!Number.isFinite(dpr) || dpr <= 0) throw new Error("Die Seitengröße kann nicht dargestellt werden.");
      canvas.width = Math.ceil(viewport.width * dpr); canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
      canvas.setAttribute("aria-hidden", "true");
      const textHost = document.createElement("div"); textHost.className = "textLayer";
      element.replaceChildren(canvas, textHost);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Die PDF-Darstellung ist in diesem Browser nicht verfügbar.");
      renderTask = page.render({ canvas, canvasContext: context, viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
      void renderTask.promise.catch(() => {});
      const textContent = await page.getTextContent();
      if (disposed) return;
      const textLayer = new engine.TextLayer({ container: textHost, viewport, textContentSource: textContent });
      layer = textLayer;
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (disposed) return;
      const geometry: PdfPageGeometry = { documentVersionId: identity.documentVersionId, pageNumber, viewBox: [...page.view], rotation: totalRotation, width: viewport.width, height: viewport.height, scale, viewportTransform: [...viewport.transform] };
      const runs = textContent.items.filter((item): item is TextItem => "str" in item);
      const text = pageText(runs);
      element.dispatchEvent(new CustomEvent("stex-pdf-page-ready", { bubbles: true, detail: { ...geometry, text: text.text, textVersion: PDF_TEXT_VERSION, runs, positions: text.positions } }));
      setLoading(false);
      if (!text.text.trim()) setNotice("Diese Seite enthält keinen auswählbaren Text. Für Scans wäre später OCR erforderlich.");
      const activeTarget = pdfSearchTargetForPage(getSearchTarget(), pageNumber);
      if (activeTarget && (activeTarget.quote || activeTarget.start !== undefined)) {
        const exact = activeTarget.textVersion === PDF_TEXT_VERSION && Number.isSafeInteger(activeTarget.start) && Number.isSafeInteger(activeTarget.end)
          && activeTarget.start! >= 0 && activeTarget.end! > activeTarget.start! && activeTarget.end! <= text.text.length
          ? { start: activeTarget.start!, end: activeTarget.end! } : null;
        const proof = exact && activeTarget.quote ? findQuote(text.text.slice(exact.start, exact.end), activeTarget.quote) : null;
        const interval = exact && (!activeTarget.quote || (proof?.start === 0 && proof.end === exact.end - exact.start)) ? exact
          : activeTarget.quote ? findQuote(text.text, activeTarget.quote, activeTarget.occurrence) : null;
        if (!interval || !selectInterval(textLayer.textDivs, text.positions, interval)) setNotice("Die Textstelle lässt sich auf dieser Seite nicht zuverlässig auswählen.");
      }
    })().catch(reason => {
      if (!disposed) { element.replaceChildren(); setError(reason instanceof Error ? reason.message : "Die Seite konnte nicht geladen werden."); setLoading(false); }
    });
    return () => { disposed = true; controller.abort(); renderTask?.cancel(); layer?.cancel(); element.replaceChildren(); };
  }, [active, engine, pdf, identity, pageNumber, width, zoom, rotation, getSearchTarget, onPageSize]);

  return <div ref={register} className="pdf-page-slot" style={{ minHeight: `${estimatedHeight}px` }}
    role="group" aria-label={`PDF-Seite ${pageNumber}`} data-pdf-page={pageNumber} data-document-version-id={identity.documentVersionId}>
    {active ? <div ref={host} className="pdf-sheet" /> : <div className="pdf-page-placeholder" style={{ width: `${estimatedWidth}px`, height: `${estimatedHeight}px` }} aria-hidden="true">Seite {pageNumber}</div>}
    {active && loading && <p className="pdf-page-status" role="status">Seite {pageNumber} wird geladen …</p>}
    {active && error && <div className="pdf-page-error" role="alert"><p>{error}</p><Link href="/konto" className="underline">Zum Kontozugang</Link></div>}
    {active && notice && <p className="pdf-page-notice" role="status">{notice}</p>}
  </div>;
});

export function CatalogPdfViewer({ identity, initialTarget }: { identity: PdfIdentity; initialTarget: PdfSearchTarget }) {
  const [descriptor, setDescriptor] = useState<PdfDescriptor | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [pageNumber, setPageNumber] = useState(initialTarget.pageNumber);
  const [pageInput, setPageInput] = useState(String(initialTarget.pageNumber));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [width, setWidth] = useState(800);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const searchTargetRef = useRef<PdfSearchTarget | null>(initialTarget);
  const [pageSizes, setPageSizes] = useState<Record<number, PageSize>>({});
  const downloadBusy = useRef(false);
  const downloadCommand = useRef<{ target: string; requestId: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pageElements = useRef(new Map<number, HTMLElement>());
  const pageObserver = useRef<IntersectionObserver | null>(null);
  const visiblePages = useRef(new Map<number, VisiblePdfPage>());
  const trackingReady = useRef(false);
  const getSearchTarget = useCallback(() => searchTargetRef.current, []);
  const button = "rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-40";

  const registerPage = useCallback((number: number, element: HTMLElement | null) => {
    const previous = pageElements.current.get(number);
    if (previous && previous !== element) { pageObserver.current?.unobserve(previous); visiblePages.current.delete(number); }
    if (element) { pageElements.current.set(number, element); pageObserver.current?.observe(element); }
    else pageElements.current.delete(number);
  }, []);

  const recordPageSize = useCallback((number: number, size: PageSize) => {
    setPageSizes(current => {
      const previous = current[number];
      if (previous && previous.width === size.width && previous.height === size.height) return current;
      return { ...current, [number]: size };
    });
  }, []);

  const clearSearchTarget = useCallback(() => {
    if (!searchTargetRef.current) return;
    searchTargetRef.current = null;
    const url = new URL(window.location.href);
    ["quote", "occurrence", "start", "end", "textVersion"].forEach(key => url.searchParams.delete(key));
    window.history.replaceState(null, "", url);
  }, []);

  const setUrlPage = useCallback((number: number) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("page") === String(number)) return;
    url.searchParams.set("page", String(number)); window.history.replaceState(null, "", url);
  }, []);

  const updateVisiblePage = useCallback(() => {
    const root = stage.current;
    if (!root || !trackingReady.current) return;
    const rootRect = root.getBoundingClientRect();
    const top = rootRect.top + root.clientTop, bottom = top + root.clientHeight;
    for (const number of visiblePages.current.keys()) {
      const element = pageElements.current.get(number);
      if (!element) { visiblePages.current.delete(number); continue; }
      const rect = element.getBoundingClientRect();
      visiblePages.current.set(number, { pageNumber: number, top: rect.top, bottom: rect.bottom, intersecting: rect.bottom > top && rect.top < bottom });
    }
    const next = visiblePdfPage(visiblePages.current.values(), top, top + root.clientHeight);
    if (next === null) return;
    setPageNumber(next); setPageInput(String(next));
    if (searchTargetRef.current && searchTargetRef.current.pageNumber !== next) clearSearchTarget();
    setUrlPage(next);
  }, [clearSearchTarget, setUrlPage]);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const visiblePageEntries = visiblePages.current;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const number = Number((entry.target as HTMLElement).dataset.pdfPage);
        if (!Number.isSafeInteger(number) || number < 1) continue;
        if (entry.isIntersecting) visiblePageEntries.set(number, { pageNumber: number, top: entry.boundingClientRect.top, bottom: entry.boundingClientRect.bottom, intersecting: true });
        else visiblePageEntries.delete(number);
      }
      updateVisiblePage();
    }, { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    pageObserver.current = observer;
    for (const element of pageElements.current.values()) observer.observe(element);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; updateVisiblePage(); });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); root.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); pageObserver.current = null; visiblePageEntries.clear(); };
  }, [updateVisiblePage]);

  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.floor(entries[0].contentRect.width - 32))));
    observer.observe(stage.current); return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!identity) return;
    let disposed = false;
    const controller = new AbortController();
    let task: ReturnType<Engine["getDocument"]> | undefined;
    void (async () => {
      const metadata = await description(identity, controller.signal);
      const moduleURL = `/api/catalog/pdf-engine/build/pdf.min.mjs?v=${enginePackage.version}`;
      const api = await import(/* webpackIgnore: true */ moduleURL) as Engine;
      if (disposed) return;
      api.GlobalWorkerOptions.workerSrc = `/api/catalog/pdf-engine/build/pdf.worker.min.mjs?v=${enginePackage.version}`;
      setEngine(api);
      task = api.getDocument({ url: pdfFileURL(identity), withCredentials: true, isEvalSupported: false,
        disableAutoFetch: true, disableStream: true,
        cMapUrl: "/api/catalog/pdf-engine/cmaps/", cMapPacked: true,
        standardFontDataUrl: "/api/catalog/pdf-engine/standard_fonts/", wasmUrl: "/api/catalog/pdf-engine/wasm/" });
      const document = await task.promise;
      if (disposed) return;
      setDescriptor(metadata); setPdf(document); setLoading(false);
      setPageNumber(current => Math.min(current, document.numPages));
    })().catch(reason => { if (!disposed) { setError(reason instanceof Error ? reason.message : "Das PDF konnte nicht geladen werden."); setLoading(false); } });
    return () => { disposed = true; controller.abort(); void task?.destroy(); };
  }, [identity]);

  useEffect(() => {
    if (!pdf || !stage.current) return;
    trackingReady.current = false;
    const frame = requestAnimationFrame(() => {
      const page = pageElements.current.get(initialTarget.pageNumber);
      const root = stage.current;
      if (page && root) {
        const rootTop = root.getBoundingClientRect().top + root.clientTop;
        root.scrollTop += page.getBoundingClientRect().top - rootTop;
      }
      trackingReady.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [pdf, initialTarget.pageNumber]);

  function navigate(page: number) {
    if (!pdf || !Number.isSafeInteger(page) || page < 1 || page > pdf.numPages) { setPageInput(String(pageNumber)); return; }
    clearSearchTarget(); window.getSelection()?.removeAllRanges();
    setPageNumber(page); setPageInput(String(page)); setUrlPage(page);
    const element = pageElements.current.get(page), root = stage.current;
    if (element && root) {
      const rootTop = root.getBoundingClientRect().top + root.clientTop;
      root.scrollTo({ top: root.scrollTop + element.getBoundingClientRect().top - rootTop, behavior: "auto" });
    }
  }

  async function download() {
    if (!descriptor || downloadBusy.current) return;
    downloadBusy.current = true; setDownloading(true); setDownloadError("");
    const targetKey = JSON.stringify([identity.klausurId, identity.documentId, identity.documentVersionId]);
    try {
      if (downloadCommand.current?.target !== targetKey) downloadCommand.current = { target: targetKey, requestId: crypto.randomUUID() };
      const response = await fetch(PDF_DOWNLOAD_URL, { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Stex-Action": "1" },
        body: JSON.stringify({ ...identity, requestId: downloadCommand.current.requestId }) });
      if (!response.ok) {
        if (response.status < 500) downloadCommand.current = null;
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Der PDF-Download ist gerade nicht verfügbar. Bitte erneut versuchen.");
      }
      const blob = await response.blob();
      const filename = /filename="([a-zA-Z0-9 _().-]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "Dokument.pdf";
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      downloadCommand.current = null;
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : "Der PDF-Download konnte nicht gestartet werden. Bitte erneut versuchen.");
    } finally { downloadBusy.current = false; setDownloading(false); }
  }

  const pages = pdf ? pdfRenderWindow(pageNumber, pdf.numPages) : [];
  const pageCount = pdf?.numPages ?? 0;
  const defaultSize = pageSizes[1] ?? { width: 595, height: 842 };

  return <main className="catalog-pdf-main mx-auto max-w-7xl px-2 py-4 sm:px-6">
    <Link href="/konto/klausuren" className="text-sm underline">← Gemeinsamer Katalog</Link>
    <h1 className="mt-3 text-xl font-medium">{descriptor?.title ?? "Klausur lesen"}</h1>
    {descriptor && <p className="mb-3 text-sm text-slate-600">{descriptor.role === "loesung" ? "Lösung" : descriptor.role === "sachverhalt" ? "Sachverhalt" : descriptor.role} · Version {descriptor.versionNumber}</p>}
    <div className="sticky top-0 z-10 my-3 flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2" aria-label="PDF-Steuerung">
      <button className={button} disabled={!pdf || pageNumber <= 1 || !!error} onClick={() => navigate(pageNumber - 1)} aria-label="Vorherige Seite">←</button>
      <form className="flex items-center gap-1 text-sm" onSubmit={event => { event.preventDefault(); navigate(Number(pageInput)); }}>
        <label htmlFor="pdf-page">Seite</label><input id="pdf-page" className="w-16 rounded border bg-white p-2" inputMode="numeric" type="number" min="1" max={pdf?.numPages} value={pageInput} disabled={!pdf || !!error} onChange={event => setPageInput(event.target.value)} /><span>von {pdf?.numPages ?? "…"}</span>
        <button className={button} disabled={!pdf || !!error}>Öffnen</button>
      </form>
      <button className={button} disabled={!pdf || pageNumber >= pdf.numPages || !!error} onClick={() => navigate(pageNumber + 1)} aria-label="Nächste Seite">→</button>
      <button className={button} disabled={!pdf || zoom <= 0.5 || !!error} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))} aria-label="Verkleinern">−</button>
      <span className="text-sm" aria-label="Zoom">{Math.round(zoom * 100)} %</span>
      <button className={button} disabled={!pdf || zoom >= 3 || !!error} onClick={() => setZoom(value => Math.min(3, value + 0.25))} aria-label="Vergrößern">+</button>
      <button className={button} disabled={!pdf || !!error} onClick={() => setZoom(1)}>Seitenbreite</button>
      <button className={button} disabled={!pdf || !!error} onClick={() => setRotation(value => (value + 90) % 360)}>Drehen</button>
      <button className={button} disabled={!descriptor || downloading || !!error} onClick={() => void download()}>{downloading ? "Download wird vorbereitet …" : "PDF herunterladen"}</button>
    </div>
    {downloadError && <p role="alert" className="my-2 text-sm text-red-800">{downloadError}</p>}
    {loading && <p role="status" className="py-2 text-sm">PDF wird geladen …</p>}
    {error && <div role="alert" className="my-4 rounded-lg bg-red-50 p-4"><p>{error}</p><Link href="/konto" className="underline">Zum Kontozugang</Link> · <button className="underline" onClick={() => window.location.reload()}>Erneut laden</button></div>}
    <div ref={stage} className="pdf-stage" role="region" aria-label="PDF-Lesebereich" tabIndex={0} onPointerDown={event => { clearSearchTarget(); if (!(event.target as HTMLElement).closest(".textLayer span")) window.getSelection()?.removeAllRanges(); }}>
      {pdf && <div className="pdf-pages" role="group" aria-label="PDF-Seiten">
        {Array.from({ length: pageCount }, (_, index) => {
          const number = index + 1, active = pages.includes(number), size = pageSizes[number] ?? defaultSize;
          const estimatedScale = Math.min(width / size.width, 1.6) * zoom;
          const estimatedWidth = Math.ceil(estimatedScale * size.width), estimatedHeight = Math.ceil(estimatedScale * size.height);
          return <CatalogPdfPage key={`${identity.documentVersionId}:${number}`} pdf={pdf} engine={engine} identity={identity} pageNumber={number}
            active={active} width={width} zoom={zoom} rotation={rotation} getSearchTarget={getSearchTarget} estimatedWidth={estimatedWidth} estimatedHeight={estimatedHeight}
            registerPage={registerPage} onPageSize={recordPageSize} />;
        })}
      </div>}
    </div>
  </main>;
}
