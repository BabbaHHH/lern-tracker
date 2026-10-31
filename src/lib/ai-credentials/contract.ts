export type AiCredentialSource = "pilot" | "own";
export type AiCredentialSelection = AiCredentialSource | "off";

/** Equality precondition for the currently displayed signed-in account; never an auth credential. */
export interface AiCredentialActorContext {
  accountId: string;
  accessGeneration: number;
  sessionContext: string;
}

/** Admin target binding; the server still resolves and validates the target account. */
export interface AiCredentialTargetContext {
  accountId: string;
  accessGeneration: number;
}

export interface AiCredentialRequestOptions {
  requestId: string;
  expectedRevision: number | null;
  expectedActorContext: AiCredentialActorContext;
  expectedTargetContext?: AiCredentialTargetContext;
}

export interface AiCredentialSummary {
  configured: boolean;
  revision: number;
  maskedKey: string | null;
}

export interface AiCredentialStatus {
  contractVersion: 2;
  context: AiCredentialActorContext;
  account: { userId: string; status: string; role: string };
  selection: { source: AiCredentialSelection; revision: number };
  credentials: Record<AiCredentialSource, AiCredentialSummary>;
  providerStatus: null | {
    state: "ready" | "missing" | "invalid" | "busy" | "unavailable";
    source?: AiCredentialSource;
    limit?: number | null;
    limitRemaining?: number | null;
    limitReset?: string | null;
    isFreeTier?: boolean;
    message?: string;
  };
}

export interface AiCredentialAdminTarget {
  userId: string;
  email: string;
  name: string;
  status: string;
  role: string;
}

export interface AiCredentialAdminStatus {
  contractVersion: 2;
  actorContext: AiCredentialActorContext;
  targetContext: AiCredentialTargetContext;
  target: { userId: string; status: string; role: string };
  credential: AiCredentialSummary;
  selected: boolean;
}
