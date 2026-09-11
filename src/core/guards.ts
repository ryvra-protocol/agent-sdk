import { CapabilityMismatchError, ValidationError } from './errors.js';
import type { FinancialIntent, FinancialIntentAction, KnownMandate } from './types.js';

export function ensureKnownCapability(
  intent: FinancialIntent,
  capabilities?: FinancialIntentAction[],
): void {
  if (!capabilities || capabilities.length === 0) {
    return;
  }

  if (!capabilities.includes(intent.action)) {
    throw new CapabilityMismatchError('Intent action is outside the known capability set', {
      reasonCode: 'CAPABILITY_MISMATCH',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }
}

export function ensureMandateActive(intent: FinancialIntent, mandate?: KnownMandate, clockSkewMs = 30_000): void {
  if (!mandate?.expiresAt) {
    return;
  }

  const expiresAt = new Date(mandate.expiresAt);
  if (Number.isNaN(expiresAt.valueOf())) {
    throw new ValidationError('Known mandate expiry is invalid', {
      reasonCode: 'MANDATE_EXPIRY_INVALID',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }

  if (expiresAt.valueOf() + clockSkewMs < Date.now()) {
    throw new ValidationError('Known mandate is expired', {
      reasonCode: 'MANDATE_EXPIRED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
    });
  }
}

export function ensureWithinSoftLimit(intent: FinancialIntent, softLimit?: string): void {
  if (!softLimit) {
    return;
  }

  const rawAmount = intent.details.amount;
  const amount = rawAmount && typeof rawAmount === 'object' && 'value' in rawAmount ? Number(rawAmount.value) : Number.NaN;
  const limit = Number(softLimit);

  if (!Number.isFinite(amount) || !Number.isFinite(limit)) {
    return;
  }

  if (amount > limit) {
    throw new ValidationError('Intent amount exceeds the client-known soft limit', {
      reasonCode: 'SOFT_LIMIT_EXCEEDED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { amount, softLimit: limit },
    });
  }
}
