export type ActorType = 'AGENT';

export type FinancialIntentAction =
  | 'PAY'
  | 'TRANSFER'
  | 'SWAP'
  | 'TRADE'
  | 'REBALANCE'
  | 'COLLECT'
  | 'OPEN_POSITION'
  | 'CLOSE_POSITION';

export interface IntentAmount {
  value: string;
  currency?: string;
}

export interface FinancialIntent<TAction extends FinancialIntentAction = FinancialIntentAction, TDetails extends object = Record<string, unknown>> {
  intentId: string;
  actorType: ActorType;
  actorId: string;
  action: TAction;
  assetId: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  idempotencyKey: string;
  expiresAt: string;
  mandateId: string;
  metadata?: Record<string, unknown>;
  details: TDetails;
}

export interface BaseIntentInput {
  intentId: string;
  actorType?: ActorType;
  actorId: string;
  assetId: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  idempotencyKey?: string;
  expiresAt: string | Date;
  mandateId: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayErrorPayload {
  message?: string;
  reasonCode?: string;
  intentId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export interface RequestContext {
  correlationId?: string;
  idempotencyKey?: string;
}

export interface Logger {
  debug?(message: string, payload?: unknown): void;
  info?(message: string, payload?: unknown): void;
  warn?(message: string, payload?: unknown): void;
  error?(message: string, payload?: unknown): void;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
}

export type TokenProvider = string | (() => string | Promise<string>);

export interface RequestSignerConfig {
  keyId: string;
  secret: string;
  clock?: () => Date;
}

export interface GatewayClientConfig {
  baseUrl: string;
  auth: TokenProvider;
  signing: RequestSignerConfig;
  timeoutMs?: number;
  clockSkewMs?: number;
  retry?: RetryOptions;
  logger?: Logger;
  fetchImplementation?: typeof fetch;
}

export interface KnownMandate {
  mandateId: string;
  expiresAt?: string;
  capabilities?: FinancialIntentAction[];
  softLimits?: Partial<Record<string, string>>;
}

export interface SubmitIntentOptions {
  knownCapabilities?: FinancialIntentAction[];
  mandate?: KnownMandate;
  softLimit?: string;
}
