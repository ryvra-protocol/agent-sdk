import { ValidationError } from '../core/errors.js';
import { createIdempotencyKey } from '../core/idempotency.js';
import type { BaseIntentInput, FinancialIntent, FinancialIntentAction, IntentAmount } from '../core/types.js';

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

function assertAllowedValue(
  action: FinancialIntentAction,
  field: string,
  value: unknown,
  allowedValues: string[],
  input: Pick<BaseIntentInput, 'intentId' | 'correlationId'>,
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new ValidationError(`Invalid ${action} detail field: ${field}`, {
      reasonCode: 'VALIDATION_INVALID_ENUM',
      intentId: input.intentId,
      correlationId: input.correlationId,
      details: { action, field, allowedValues },
    });
  }
}

function assertAmountShape(
  action: FinancialIntentAction,
  details: Record<string, unknown>,
  input: Pick<BaseIntentInput, 'intentId' | 'correlationId'>,
): void {
  if (!('amount' in details) || details.amount === undefined) {
    return;
  }

  if (
    !details.amount
    || typeof details.amount !== 'object'
    || !('value' in details.amount)
    || typeof details.amount.value !== 'string'
    || details.amount.value.trim() === ''
  ) {
    throw new ValidationError(`Invalid ${action} amount payload`, {
      reasonCode: 'VALIDATION_INVALID_AMOUNT',
      intentId: input.intentId,
      correlationId: input.correlationId,
      details: { action },
    });
  }
}

function assertActionSpecificRules(
  action: FinancialIntentAction,
  details: Record<string, unknown>,
  input: Pick<BaseIntentInput, 'intentId' | 'correlationId'>,
): void {
  assertAmountShape(action, details, input);

  switch (action) {
    case 'TRADE':
      assertAllowedValue(action, 'side', details.side, ['BUY', 'SELL'], input);
      assertAllowedValue(action, 'orderType', details.orderType, ['MARKET', 'LIMIT'], input);
      if (details.orderType === 'LIMIT' && (typeof details.limitPrice !== 'string' || details.limitPrice.trim() === '')) {
        throw new ValidationError('LIMIT trade intents require limitPrice', {
          reasonCode: 'VALIDATION_REQUIRED_FIELD',
          intentId: input.intentId,
          correlationId: input.correlationId,
          details: { action, field: 'limitPrice' },
        });
      }
      break;
    case 'OPEN_POSITION':
      assertAllowedValue(action, 'side', details.side, ['LONG', 'SHORT'], input);
      break;
    case 'REBALANCE':
      if (
        !details.targetAllocation
        || typeof details.targetAllocation !== 'object'
        || Object.keys(details.targetAllocation).length === 0
      ) {
        throw new ValidationError('REBALANCE intents require a non-empty targetAllocation', {
          reasonCode: 'VALIDATION_REQUIRED_FIELD',
          intentId: input.intentId,
          correlationId: input.correlationId,
          details: { action, field: 'targetAllocation' },
        });
      }
      break;
    default:
      break;
  }
}

export function buildIntent<TAction extends FinancialIntentAction, TDetails extends object>(
  action: TAction,
  input: BaseIntentInput,
  details: TDetails,
  canonical: Partial<Pick<FinancialIntent, 'amount' | 'chainId' | 'recipient' | 'venue' | 'profileType'>> = {},
): FinancialIntent<TAction, TDetails> {
  assertRequiredBaseFields(input);
  validateIntentDetails(action, details, input);

  return Object.freeze({
    intentId: input.intentId,
    actorType: 'AGENT' as const,
    actorId: input.actorId,
    action,
    assetId: input.assetId,
    amount: canonical.amount,
    chainId: canonical.chainId,
    recipient: canonical.recipient,
    venue: canonical.venue,
    purpose: input.purpose,
    policyVersion: input.policyVersion,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(action.toLowerCase()),
    expiresAt: normalizeExpiresAt(input),
    mandateId: input.mandateId,
    profileType: canonical.profileType,
    metadata: input.metadata,
    details,
  });
}

function assertNonEmptyString(
  field: string,
  value: unknown,
  input: Pick<FinancialIntent, 'intentId' | 'correlationId'>,
  reasonCode: string,
): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`Intent is missing required ${field}`, {
      reasonCode,
      intentId: input.intentId,
      correlationId: input.correlationId,
      details: { field },
    });
  }
}

function assertTopLevelAmount(input: FinancialIntent): void {
  if (input.amount === undefined) {
    return;
  }

  const amount = input.amount as IntentAmount;
  if (typeof amount?.value !== 'string' || amount.value.trim() === '') {
    throw new ValidationError('Intent amount must be a valid canonical amount payload', {
      reasonCode: 'VALIDATION_INVALID_AMOUNT',
      intentId: input.intentId,
      correlationId: input.correlationId,
      details: { field: 'amount' },
    });
  }
}

export function validateFinancialIntent(intent: FinancialIntent, clockSkewMs = 30_000): void {
  if (intent.actorType !== 'AGENT') {
    throw new ValidationError('Agent SDK only supports actorType=AGENT', {
      reasonCode: 'ACTOR_TYPE_INVALID',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }

  assertNonEmptyString('correlationId', intent.correlationId, intent, 'CORRELATION_ID_REQUIRED');
  assertNonEmptyString('idempotencyKey', intent.idempotencyKey, intent, 'IDEMPOTENCY_KEY_REQUIRED');
  assertNonEmptyString('mandateId', intent.mandateId, intent, 'MANDATE_ID_REQUIRED');
  assertNonEmptyString('policyVersion', intent.policyVersion, intent, 'POLICY_VERSION_REQUIRED');
  assertTopLevelAmount(intent);

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

  assertActionSpecificRules(action, entries, input);
}
