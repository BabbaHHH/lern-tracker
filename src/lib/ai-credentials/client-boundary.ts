import type { AiCredentialActorContext } from "./contract";

export function sameAiCredentialContext(a: AiCredentialActorContext | null, b: AiCredentialActorContext | null): boolean {
  return !!a && !!b && a.accountId === b.accountId && a.accessGeneration === b.accessGeneration
    && a.sessionContext === b.sessionContext;
}

/** Drops late reads and separates credential UI state across account and session changes. */
export class AiCredentialClientBoundary {
  private sequence = 0;
  private current: AiCredentialActorContext | null = null;

  begin(): number { return ++this.sequence; }

  accept(sequence: number, incoming: AiCredentialActorContext): "stale" | "accepted" | "changed" {
    if (sequence !== this.sequence) return "stale";
    const changed = this.current !== null && !sameAiCredentialContext(this.current, incoming);
    this.current = incoming;
    return changed ? "changed" : "accepted";
  }

  isCurrent(sequence: number): boolean { return sequence === this.sequence; }
  context(): AiCredentialActorContext | null { return this.current; }
  invalidate(): void { this.sequence += 1; }
  reset(): void { this.current = null; this.invalidate(); }
}
