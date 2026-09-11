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

export type AutonomousProfileType = 'TREASURY' | 'PORTFOLIO' | 'PROCUREMENT' | 'MARKET' | 'SETTLEMENT';
export type AutonomyLevel = 'A0' | 'A1' | 'A2' | 'A3';

export interface IntentAmount {
  value: string;
  currency?: string;
}

export interface SpendWindowLimit {
  maxAmount: string;
  windowMs: number;
  assetId?: string;
  currency?: string;
}

export interface SpendLimits {
  perTransaction?: Record<string, string>;
  perWindow?: SpendWindowLimit[];
}

export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
  action?: FinancialIntentAction;
}

export interface EscalationThresholds {
  reviewAmount?: string;
  challengeAmount?: string;
  delayAmount?: string;
  quarantineAmount?: string;
}

export interface RequiredAuthorityRefs {
  mandateId: string;
  policyVersion: string;
  riskAssessmentId?: string;
  authorizationId?: string;
}

export interface TimeoutDefaults {
  submitMs?: number;
  statusMs?: number;
  approvalMs?: number;
}

export interface AutonomousProfileConfig {
  profileType: AutonomousProfileType;
  autonomyLevel: AutonomyLevel;
  actionAllowlist: FinancialIntentAction[];
  spendLimits?: SpendLimits;
  rateLimits?: RateLimitRule[];
  escalationThresholds?: EscalationThresholds;
  requiredAuthorityRefs: RequiredAuthorityRefs;
  retryPolicy?: RetryOptions;
  timeoutDefaults?: TimeoutDefaults;
  maxExpiryWindowMs?: number;
}

export interface FinancialIntent<TAction extends FinancialIntentAction = FinancialIntentAction, TDetails extends object = Record<string, unknown>> {
  intentId: string;
  actorType: ActorType;
  actorId: string;
  action: TAction;
  assetId: string;
  amount?: IntentAmount;
  chainId?: string;
  recipient?: string;
  venue?: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  idempotencyKey: string;
  expiresAt: string;
  mandateId: string;
  profileType?: AutonomousProfileType;
  metadata?: Record<string, unknown>;
  details: TDetails;
}

export interface BaseIntentInput {
  intentId: string;
  actorType?: ActorType;
  actorId: string;
  assetId: string;
  amount?: IntentAmount;
  chainId?: string;
  recipient?: string;
  venue?: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  idempotencyKey?: string;
  expiresAt: string | Date;
  mandateId: string;
  profileType?: AutonomousProfileType;
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
