import { sameSearchContext, type SearchContext } from "./catalog-contract";
/** No browser storage. Invalidates in-flight responses on focus/session changes. */
export class SearchBoundary {
  sequence = 0;
  context: SearchContext | null = null;
  invalidate() { return ++this.sequence; }
  accept(sequence: number, incoming: SearchContext) {
    if (sequence !== this.sequence) return "stale";
    if (this.context && !sameSearchContext(this.context, incoming)) {
      this.context = null; this.invalidate(); return "changed";
    }
    this.context = incoming; return "accepted";
  }
  reset() { this.context = null; this.invalidate(); }
}
