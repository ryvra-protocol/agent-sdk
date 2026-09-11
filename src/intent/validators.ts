import { ValidationError } from '../core/errors.js';
import { createIdempotencyKey } from '../core/idempotency.js';
import type { BaseIntentInput, FinancialIntent, FinancialIntentAction } from '../core/types.js';

const REQUIRED_BASE_FIELDS: Array<keyof BaseIntentInput> = [
  'intentId',
  'actorId',
  'assetId',
  'purpose',
  'policyVersion',
  'correlationId',
  'expiresAt',
  'mandateId',
];

function assertRequiredBaseFields(input: BaseIntentInput): void {
  for (const field of REQUIRED_BASE_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`Missing required field: ${field}`, {
        reasonCode: 'VALIDATION_REQUIRED_FIELD',
        intentId: input.intentId,
        correlationId: input.correlationId,
        details: { field },
      });
    }
  }

  if (input.actorType && input.actorType !== 'AGENT') {
    throw new ValidationError('Agent SDK only supports actorType=AGENT', {
      reasonCode: 'ACTOR_TYPE_INVALID',
      intentId: input.intentId,
      correlationId: input.correlationId,
    });
  }
}

function normalizeExpiresAt(input: BaseIntentInput): string {
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt;
  const parsed = new Date(expiresAt);

  if (Number.isNaN(parsed.valueOf())) {
    throw new ValidationError('expiresAt must be a valid ISO-8601 timestamp', {
      reasonCode: 'EXPIRES_AT_INVALID',
      intentId: input.intentId,
      correlationId: input.correlationId,
    });
  }

  return parsed.toISOString();
}

export function buildIntent<TAction extends FinancialIntentAction, TDetails extends object>(
  action: TAction,
  input: BaseIntentInput,
  details: TDetails,
): FinancialIntent<TAction, TDetails> {
  assertRequiredBaseFields(input);
  validateIntentDetails(action, details, input);

  return Object.freeze({
    intentId: input.intentId,
    actorType: 'AGENT' as const,
    actorId: input.actorId,
    action,
    assetId: input.assetId,
    purpose: input.purpose,
    policyVersion: input.policyVersion,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(action.toLowerCase()),
    expiresAt: normalizeExpiresAt(input),
    mandateId: input.mandateId,
    metadata: input.metadata,
    details,
  });
}

export function validateFinancialIntent(intent: FinancialIntent, clockSkewMs = 30_000): void {
  if (intent.actorType !== 'AGENT') {
    throw new ValidationError('Agent SDK only supports actorType=AGENT', {
      reasonCode: 'ACTOR_TYPE_INVALID',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }

  const expiresAt = new Date(intent.expiresAt);
  if (Number.isNaN(expiresAt.valueOf()) || expiresAt.valueOf() + clockSkewMs < Date.now()) {
    throw new ValidationError('Intent is expired or has an invalid expiry timestamp', {
      reasonCode: 'INTENT_EXPIRED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }
}

export function validateIntentDetails(
  action: FinancialIntentAction,
  details: object,
  input: Pick<BaseIntentInput, 'intentId' | 'correlationId'>,
): void {
  const entries = details as Record<string, unknown>;
  const requiredByAction: Record<FinancialIntentAction, string[]> = {
    PAY: ['amount', 'recipientId'],
    TRANSFER: ['amount', 'destinationAccountId'],
    SWAP: ['amount', 'destinationAssetId'],
    TRADE: ['amount', 'instrumentId', 'side'],
    REBALANCE: ['targetAllocation'],
    COLLECT: ['amount', 'sourceAccountId'],
    OPEN_POSITION: ['amount', 'instrumentId', 'side'],
    CLOSE_POSITION: ['positionId'],
  };

  for (const field of requiredByAction[action]) {
    const value = entries[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`Missing ${action} detail field: ${field}`, {
        reasonCode: 'VALIDATION_REQUIRED_FIELD',
        intentId: input.intentId,
        correlationId: input.correlationId,
        details: { action, field },
      });
    }
  }
}
