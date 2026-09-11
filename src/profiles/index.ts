import type { ApprovalPayload } from '../client.js';
import { AgentGatewayClient } from '../client.js';
import { ensureKnownCapability, ensureWithinSoftLimit, compareDecimalStrings } from '../core/guards.js';
import { ValidationError } from '../core/errors.js';
import type {
  AutonomousProfileConfig,
  AutonomousProfileType,
  BaseIntentInput,
  FinancialIntent,
  FinancialIntentAction,
  RequiredAuthorityRefs,
} from '../core/types.js';
import type { AuditEvent, DecisionTrace, TimelineEvent } from '../audit/index.js';
import { normalizeGatewayDecisionEvents, summarizeRunOutcomes } from '../audit/index.js';
import { validateFinancialIntent } from '../intent/validators.js';

export const DEFAULT_PROFILE_MAX_EXPIRY_WINDOW_MS = 15 * 60_000;

export const PROFILE_ALLOWED_ACTIONS: Record<AutonomousProfileType, FinancialIntentAction[]> = {
  TREASURY: ['PAY', 'TRANSFER', 'REBALANCE', 'COLLECT', 'SWAP'],
  PORTFOLIO: ['REBALANCE', 'TRADE', 'OPEN_POSITION', 'CLOSE_POSITION', 'SWAP'],
  PROCUREMENT: ['PAY', 'TRANSFER'],
  MARKET: ['TRADE', 'OPEN_POSITION', 'CLOSE_POSITION'],
  SETTLEMENT: ['TRANSFER', 'COLLECT'],
};

export type GatewayDecisionStatus = 'PENDING' | 'APPROVED' | 'REVIEW' | 'CHALLENGE' | 'DELAY' | 'QUARANTINE' | 'DENIED' | 'BLOCKED' | 'CANCELLED' | 'UNKNOWN';

export interface GatewayDecision<TIntent extends FinancialIntent = FinancialIntent> {
  intentId: string;
  status: GatewayDecisionStatus;
  reasonCode?: string;
  correlationId?: string;
  profileType?: AutonomousProfileType;
  intent?: TIntent;
  details?: Record<string, unknown>;
  humanActionRequired: boolean;
  terminal: boolean;
}

export interface GatewayDecisionResponse<TIntent extends FinancialIntent = FinancialIntent> {
  intent?: TIntent;
  intentId?: string;
  status?: string;
  reasonCode?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export interface ProfileValidationWarning {
  code: 'RISK_LINKAGE_RECOMMENDED' | 'AUTHORIZATION_LINKAGE_RECOMMENDED';
  message: string;
  action: FinancialIntentAction;
  profileType: AutonomousProfileType;
}

export interface ProfileValidationResult {
  warnings: ProfileValidationWarning[];
}

export interface EscalationHandlers<TIntent extends FinancialIntent = FinancialIntent, TResult = void> {
  onPending?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onApproved?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onReview?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onChallenge?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onDelay?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onQuarantine?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onDenied?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onBlocked?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onCancelled?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
  onUnknown?(decision: GatewayDecision<TIntent>): TResult | Promise<TResult>;
}

export type ProfileTemplateInput<TInput extends BaseIntentInput> = Omit<TInput, 'mandateId' | 'policyVersion' | 'profileType'>
  & Partial<Pick<TInput, 'mandateId' | 'policyVersion' | 'profileType'>>;

function assertNonEmptyString(value: unknown, field: string, reasonCode: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Profile config field ${field} is required`, {
      reasonCode,
      details: { field },
    });
  }
}

function assertPositiveInteger(value: unknown, field: string, reasonCode: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`Profile config field ${field} must be a positive integer`, {
      reasonCode,
      details: { field, value },
    });
  }
}

function assertDecimal(value: string, field: string, reasonCode: string): void {
  const comparison = compareDecimalStrings(value, '0');
  if (comparison === undefined || comparison < 0) {
    throw new ValidationError(`Profile config field ${field} must be a non-negative decimal string`, {
      reasonCode,
      details: { field, value },
    });
  }
}

function requiresRiskAssessment(profileType: AutonomousProfileType, action: FinancialIntentAction): boolean {
  return profileType === 'MARKET'
    || (profileType === 'PORTFOLIO' && ['REBALANCE', 'TRADE', 'OPEN_POSITION', 'CLOSE_POSITION', 'SWAP'].includes(action));
}

function recommendsRiskAssessment(profileType: AutonomousProfileType, action: FinancialIntentAction): boolean {
  return !requiresRiskAssessment(profileType, action) && (
    (profileType === 'TREASURY' && ['REBALANCE', 'SWAP', 'TRANSFER'].includes(action))
    || (profileType === 'SETTLEMENT' && action === 'TRANSFER')
  );
}

function recommendsAuthorizationLinkage(profileType: AutonomousProfileType, action: FinancialIntentAction): boolean {
  return (profileType === 'PROCUREMENT' && action === 'PAY')
    || (profileType === 'TREASURY' && action === 'PAY');
}

function terminalForStatus(status: GatewayDecisionStatus): boolean {
  return ['APPROVED', 'DENIED', 'BLOCKED', 'CANCELLED'].includes(status);
}

function humanActionRequiredForStatus(status: GatewayDecisionStatus): boolean {
  return ['REVIEW', 'CHALLENGE', 'DELAY', 'QUARANTINE', 'DENIED', 'BLOCKED'].includes(status);
}

function normalizeDecisionStatus(status?: string): GatewayDecisionStatus {
  const normalized = status?.toUpperCase() as GatewayDecisionStatus | undefined;
  switch (normalized) {
    case 'PENDING':
    case 'APPROVED':
    case 'REVIEW':
    case 'CHALLENGE':
    case 'DELAY':
    case 'QUARANTINE':
    case 'DENIED':
    case 'BLOCKED':
    case 'CANCELLED':
      return normalized;
    default:
      return 'UNKNOWN';
  }
}

function withAuthorityMetadata(metadata: Record<string, unknown> | undefined, authorityRefs: RequiredAuthorityRefs, templateName: string): Record<string, unknown> {
  return {
    ...metadata,
    authorityRefs: {
      mandateId: authorityRefs.mandateId,
      policyVersion: authorityRefs.policyVersion,
      ...(authorityRefs.riskAssessmentId ? { riskAssessmentId: authorityRefs.riskAssessmentId } : {}),
      ...(authorityRefs.authorizationId ? { authorizationId: authorityRefs.authorizationId } : {}),
    },
    profileTemplate: templateName,
  };
}

export function validateAutonomousProfileConfig(config: AutonomousProfileConfig): AutonomousProfileConfig {
  assertNonEmptyString(config.profileType, 'profileType', 'PROFILE_TYPE_REQUIRED');
  if (!PROFILE_ALLOWED_ACTIONS[config.profileType]) {
    throw new ValidationError('Unknown profileType', {
      reasonCode: 'PROFILE_TYPE_INVALID',
      details: { profileType: config.profileType },
    });
  }

  if (!['A0', 'A1', 'A2', 'A3'].includes(config.autonomyLevel)) {
    throw new ValidationError('autonomyLevel must be one of A0-A3', {
      reasonCode: 'AUTONOMY_LEVEL_INVALID',
      details: { autonomyLevel: config.autonomyLevel },
    });
  }

  if (!Array.isArray(config.actionAllowlist) || config.actionAllowlist.length === 0) {
    throw new ValidationError('actionAllowlist must contain at least one action', {
      reasonCode: 'ACTION_ALLOWLIST_REQUIRED',
    });
  }

  const allowedActions = PROFILE_ALLOWED_ACTIONS[config.profileType];
  for (const action of config.actionAllowlist) {
    if (!allowedActions.includes(action)) {
      throw new ValidationError('actionAllowlist includes an action outside the supported profile capability set', {
        reasonCode: 'ACTION_NOT_ALLOWED_FOR_PROFILE',
        details: { profileType: config.profileType, action },
      });
    }
  }

  assertNonEmptyString(config.requiredAuthorityRefs?.mandateId, 'requiredAuthorityRefs.mandateId', 'MANDATE_ID_REQUIRED');
  assertNonEmptyString(config.requiredAuthorityRefs?.policyVersion, 'requiredAuthorityRefs.policyVersion', 'POLICY_VERSION_REQUIRED');

  if (config.spendLimits?.perTransaction) {
    for (const [key, value] of Object.entries(config.spendLimits.perTransaction)) {
      assertDecimal(value, `spendLimits.perTransaction.${key}`, 'SPEND_LIMIT_INVALID');
    }
  }

  for (const [index, limit] of (config.spendLimits?.perWindow ?? []).entries()) {
    assertDecimal(limit.maxAmount, `spendLimits.perWindow.${index}.maxAmount`, 'SPEND_WINDOW_LIMIT_INVALID');
    assertPositiveInteger(limit.windowMs, `spendLimits.perWindow.${index}.windowMs`, 'SPEND_WINDOW_WINDOW_INVALID');
  }

  for (const [index, rule] of (config.rateLimits ?? []).entries()) {
    assertPositiveInteger(rule.maxRequests, `rateLimits.${index}.maxRequests`, 'RATE_LIMIT_INVALID');
    assertPositiveInteger(rule.windowMs, `rateLimits.${index}.windowMs`, 'RATE_LIMIT_INVALID');
  }

  if (config.timeoutDefaults) {
    if (config.timeoutDefaults.submitMs !== undefined) {
      assertPositiveInteger(config.timeoutDefaults.submitMs, 'timeoutDefaults.submitMs', 'TIMEOUT_INVALID');
    }
    if (config.timeoutDefaults.statusMs !== undefined) {
      assertPositiveInteger(config.timeoutDefaults.statusMs, 'timeoutDefaults.statusMs', 'TIMEOUT_INVALID');
    }
    if (config.timeoutDefaults.approvalMs !== undefined) {
      assertPositiveInteger(config.timeoutDefaults.approvalMs, 'timeoutDefaults.approvalMs', 'TIMEOUT_INVALID');
    }
  }

  if (config.maxExpiryWindowMs !== undefined) {
    assertPositiveInteger(config.maxExpiryWindowMs, 'maxExpiryWindowMs', 'MAX_EXPIRY_WINDOW_INVALID');
  }

  return Object.freeze({
    ...config,
    actionAllowlist: [...config.actionAllowlist],
    spendLimits: config.spendLimits ? {
      perTransaction: config.spendLimits.perTransaction ? { ...config.spendLimits.perTransaction } : undefined,
      perWindow: config.spendLimits.perWindow ? [...config.spendLimits.perWindow] : undefined,
    } : undefined,
    rateLimits: config.rateLimits ? [...config.rateLimits] : undefined,
    escalationThresholds: config.escalationThresholds ? { ...config.escalationThresholds } : undefined,
    requiredAuthorityRefs: { ...config.requiredAuthorityRefs },
    retryPolicy: config.retryPolicy ? { ...config.retryPolicy } : undefined,
    timeoutDefaults: config.timeoutDefaults ? { ...config.timeoutDefaults } : undefined,
  });
}

export function applyAutonomousProfileDefaults<TInput extends BaseIntentInput>(
  config: AutonomousProfileConfig,
  input: ProfileTemplateInput<TInput>,
  templateName: string,
): TInput {
  if (input.profileType && input.profileType !== config.profileType) {
    throw new ValidationError('Intent template profileType does not match profile client configuration', {
      reasonCode: 'PROFILE_TYPE_MISMATCH',
      intentId: input.intentId,
      correlationId: input.correlationId,
      details: { expected: config.profileType, actual: input.profileType },
    });
  }

  return {
    ...input,
    mandateId: input.mandateId ?? config.requiredAuthorityRefs.mandateId,
    policyVersion: input.policyVersion ?? config.requiredAuthorityRefs.policyVersion,
    profileType: config.profileType,
    metadata: withAuthorityMetadata(input.metadata, config.requiredAuthorityRefs, templateName),
  } as TInput;
}

function resolvePerTransactionSoftLimit(config: AutonomousProfileConfig, intent: FinancialIntent): string | undefined {
  const configured = config.spendLimits?.perTransaction;
  if (!configured) {
    return undefined;
  }

  return configured[intent.assetId] ?? (intent.amount?.currency ? configured[intent.amount.currency] : undefined);
}

export function validateProfileIntent(config: AutonomousProfileConfig, intent: FinancialIntent, clockSkewMs = 30_000): ProfileValidationResult {
  validateFinancialIntent(intent, clockSkewMs);
  ensureKnownCapability(intent, config.actionAllowlist);

  if (intent.profileType && intent.profileType !== config.profileType) {
    throw new ValidationError('Intent profileType does not match profile configuration', {
      reasonCode: 'PROFILE_TYPE_MISMATCH',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { expected: config.profileType, actual: intent.profileType },
    });
  }

  if (intent.mandateId !== config.requiredAuthorityRefs.mandateId) {
    throw new ValidationError('Intent mandateId does not match profile authority linkage', {
      reasonCode: 'MANDATE_REFERENCE_MISMATCH',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { expected: config.requiredAuthorityRefs.mandateId, actual: intent.mandateId },
    });
  }

  if (intent.policyVersion !== config.requiredAuthorityRefs.policyVersion) {
    throw new ValidationError('Intent policyVersion does not match profile authority linkage', {
      reasonCode: 'POLICY_REFERENCE_MISMATCH',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { expected: config.requiredAuthorityRefs.policyVersion, actual: intent.policyVersion },
    });
  }

  const maxExpiryWindowMs = config.maxExpiryWindowMs ?? DEFAULT_PROFILE_MAX_EXPIRY_WINDOW_MS;
  const expiresAtMs = new Date(intent.expiresAt).valueOf();
  if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > maxExpiryWindowMs) {
    throw new ValidationError('Intent expiry exceeds the configured maximum expiry window', {
      reasonCode: 'EXPIRY_WINDOW_EXCEEDED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { maxExpiryWindowMs },
    });
  }

  ensureWithinSoftLimit(intent, resolvePerTransactionSoftLimit(config, intent));

  if (requiresRiskAssessment(config.profileType, intent.action) && !config.requiredAuthorityRefs.riskAssessmentId) {
    throw new ValidationError('Risk assessment linkage is required for this profile action', {
      reasonCode: 'RISK_ASSESSMENT_REQUIRED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { profileType: config.profileType, action: intent.action },
    });
  }

  const warnings: ProfileValidationWarning[] = [];
  if (recommendsRiskAssessment(config.profileType, intent.action) && !config.requiredAuthorityRefs.riskAssessmentId) {
    warnings.push({
      code: 'RISK_LINKAGE_RECOMMENDED',
      message: 'Risk assessment linkage is recommended for this profile action',
      action: intent.action,
      profileType: config.profileType,
    });
  }

  if (recommendsAuthorizationLinkage(config.profileType, intent.action) && !config.requiredAuthorityRefs.authorizationId) {
    warnings.push({
      code: 'AUTHORIZATION_LINKAGE_RECOMMENDED',
      message: 'Authorization linkage is recommended for this payment flow',
      action: intent.action,
      profileType: config.profileType,
    });
  }

  return { warnings };
}

export function normalizeGatewayDecision<TIntent extends FinancialIntent = FinancialIntent>(response: GatewayDecisionResponse<TIntent>): GatewayDecision<TIntent> {
  const status = normalizeDecisionStatus(response.status);
  const intentId = response.intent?.intentId ?? response.intentId ?? '';

  return {
    intentId,
    status,
    reasonCode: response.reasonCode,
    correlationId: response.correlationId ?? response.intent?.correlationId,
    profileType: response.intent?.profileType,
    intent: response.intent,
    details: response.details,
    humanActionRequired: humanActionRequiredForStatus(status),
    terminal: terminalForStatus(status),
  };
}

export async function handleGatewayDecision<TIntent extends FinancialIntent = FinancialIntent, TResult = void>(
  decision: GatewayDecision<TIntent>,
  handlers: EscalationHandlers<TIntent, TResult>,
): Promise<TResult | undefined> {
  switch (decision.status) {
    case 'PENDING':
      return handlers.onPending?.(decision);
    case 'APPROVED':
      return handlers.onApproved?.(decision);
    case 'REVIEW':
      return handlers.onReview?.(decision);
    case 'CHALLENGE':
      return handlers.onChallenge?.(decision);
    case 'DELAY':
      return handlers.onDelay?.(decision);
    case 'QUARANTINE':
      return handlers.onQuarantine?.(decision);
    case 'DENIED':
      return handlers.onDenied?.(decision);
    case 'BLOCKED':
      return handlers.onBlocked?.(decision);
    case 'CANCELLED':
      return handlers.onCancelled?.(decision);
    default:
      return handlers.onUnknown?.(decision);
  }
}

export abstract class AutonomousProfileClient<TProfileType extends AutonomousProfileType> {
  readonly profileConfig: Readonly<AutonomousProfileConfig & { profileType: TProfileType }>;

  protected constructor(
    protected readonly client: AgentGatewayClient,
    config: AutonomousProfileConfig & { profileType: TProfileType },
  ) {
    this.profileConfig = validateAutonomousProfileConfig(config) as Readonly<AutonomousProfileConfig & { profileType: TProfileType }>;
  }

  get allowedActions(): readonly FinancialIntentAction[] {
    return this.profileConfig.actionAllowlist;
  }

  supportsAction(action: FinancialIntentAction): boolean {
    return this.allowedActions.includes(action);
  }

  validateIntent<TIntent extends FinancialIntent>(intent: TIntent): ProfileValidationResult {
    return validateProfileIntent(this.profileConfig, intent);
  }

  async submitIntent<TIntent extends FinancialIntent>(intent: TIntent): Promise<{ accepted: boolean; intent: TIntent; warnings: ProfileValidationWarning[] }> {
    const validation = this.validateIntent(intent);
    const softLimit = resolvePerTransactionSoftLimit(this.profileConfig, intent);
    const result = await this.client.submitIntent(intent, {
      knownCapabilities: this.profileConfig.actionAllowlist,
      softLimit,
      mandate: {
        mandateId: this.profileConfig.requiredAuthorityRefs.mandateId,
        capabilities: this.profileConfig.actionAllowlist,
        softLimits: this.profileConfig.spendLimits?.perTransaction,
      },
    });

    return {
      ...result,
      warnings: validation.warnings,
    };
  }

  async getIntentDecision<TIntent extends FinancialIntent = FinancialIntent>(intentId: string, correlationId = intentId): Promise<GatewayDecision<TIntent>> {
    const response = await this.client.getIntent<TIntent>(intentId, correlationId) as GatewayDecisionResponse<TIntent>;
    return normalizeGatewayDecision(response);
  }

  async handleIntentDecision<TIntent extends FinancialIntent = FinancialIntent, TResult = void>(
    intentId: string,
    handlers: EscalationHandlers<TIntent, TResult>,
    correlationId = intentId,
  ): Promise<TResult | undefined> {
    return handleGatewayDecision(await this.getIntentDecision<TIntent>(intentId, correlationId), handlers);
  }

  approveIntent(intentId: string, approvalPayload: ApprovalPayload, correlationId = intentId): Promise<{ approved: boolean; intentId: string }> {
    return this.client.approveIntent(intentId, approvalPayload, correlationId);
  }

  cancelIntent(intentId: string, correlationId = intentId): Promise<{ cancelled: boolean; intentId: string }> {
    return this.client.cancelIntent(intentId, correlationId);
  }

  getAuditTimelineByIntentId(intentId: string): Promise<TimelineEvent[]> {
    return this.client.audit.getIntentTimeline(intentId);
  }

  getAuditTimelineByCorrelationId(correlationId: string): Promise<TimelineEvent[]> {
    return this.client.audit.getCorrelationTimeline(correlationId);
  }

  getDecisionTraceByIntentId(intentId: string): Promise<DecisionTrace[]> {
    return this.client.audit.getDecisionTraceByIntentId(intentId);
  }

  getDecisionTraceByCorrelationId(correlationId: string): Promise<DecisionTrace[]> {
    return this.client.audit.getDecisionTraceByCorrelationId(correlationId);
  }

  async summarizeOutcomesByIntentId(intentId: string) {
    const events = await this.client.getAuditEvents({ intentId }) as AuditEvent[];
    return summarizeRunOutcomes(events);
  }

  async summarizeOutcomesByCorrelationId(correlationId: string) {
    const events = await this.client.getAuditEvents({ correlationId }) as AuditEvent[];
    return summarizeRunOutcomes(events);
  }

  protected applyDefaults<TInput extends BaseIntentInput>(input: ProfileTemplateInput<TInput>, templateName: string): TInput {
    return applyAutonomousProfileDefaults(this.profileConfig, input, templateName);
  }
}
