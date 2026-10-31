/** Private server capability. Never construct a transport from HTTP or outbox data. */
export interface DispatchMail {
  /** Stable across retries. A future provider can use this as its deduplication key. */
  readonly id: string;
  readonly email: string;
  readonly purpose: "invitation" | "verification" | "reset";
  /** Sensitive bearer link: no logging, telemetry or generic URL fetches. */
  readonly url: string;
}

export type MailTransportResult =
  | { outcome: "accepted" }
  /** May be returned ONLY when the transport knows it has not accepted the message. */
  | { outcome: "not_accepted"; retryable: boolean }
  | { outcome: "unknown" };

export interface MailTransport {
  /** Honor cancellation. Accepted means transport acceptance, not inbox delivery. */
  send(mail: Readonly<DispatchMail>, signal: AbortSignal): Promise<MailTransportResult>;
}

/** Explicit in-memory test/operator sink. No network, files, logging or automatic start. */
export function createMemoryMailSink(): MailTransport & { readonly messages: readonly DispatchMail[] } {
  const messages: DispatchMail[] = [];
  return {
    get messages() { return messages.slice(); },
    async send(mail, signal) {
      if (signal.aborted) return { outcome: "not_accepted", retryable: true };
      messages.push(Object.freeze({ ...mail }));
      return { outcome: "accepted" };
    },
  };
}
