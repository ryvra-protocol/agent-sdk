import { CapabilityMismatchError, ValidationError } from './errors.js';
import type { FinancialIntent, FinancialIntentAction, KnownMandate } from './types.js';

function normalizeDecimal(value: string): { negative: boolean; whole: string; fraction: string } | undefined {
  const match = value.trim().match(/^([+-])?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return undefined;
  }

  const negative = match[1] === '-';
  const whole = match[2].replace(/^0+(?=\d)/, '') || '0';
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  return { negative, whole, fraction };
}

function compareDecimalStrings(left: string, right: string): number | undefined {
  const normalizedLeft = normalizeDecimal(left);
  const normalizedRight = normalizeDecimal(right);

  if (!normalizedLeft || !normalizedRight) {
    return undefined;
  }

  if (normalizedLeft.negative !== normalizedRight.negative) {
    return normalizedLeft.negative ? -1 : 1;
  }

  const scale = Math.max(normalizedLeft.fraction.length, normalizedRight.fraction.length);
  const leftDigits = `${normalizedLeft.whole}${normalizedLeft.fraction.padEnd(scale, '0')}`;
  const rightDigits = `${normalizedRight.whole}${normalizedRight.fraction.padEnd(scale, '0')}`;
  const comparison = BigInt(leftDigits) === BigInt(rightDigits)
    ? 0
    : BigInt(leftDigits) > BigInt(rightDigits)
      ? 1
      : -1;

  return normalizedLeft.negative ? comparison * -1 : comparison;
}

export function ensureKnownCapability(
  intent: FinancialIntent<any, any>,
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

export function ensureMandateActive(intent: FinancialIntent<any, any>, mandate?: KnownMandate, clockSkewMs = 30_000): void {
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

export function ensureWithinSoftLimit(intent: FinancialIntent<any, any>, softLimit?: string): void {
  if (!softLimit) {
    return;
  }

  const rawAmount = intent.details.amount;
  const amount = rawAmount && typeof rawAmount === 'object' && 'value' in rawAmount ? String(rawAmount.value) : undefined;

  if (!amount) {
    return;
  }

  const comparison = compareDecimalStrings(amount, softLimit);
  if (comparison === undefined) {
    return;
  }

  if (comparison > 0) {
    throw new ValidationError('Intent amount exceeds the client-known soft limit', {
      reasonCode: 'SOFT_LIMIT_EXCEEDED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { amount, softLimit },
    });
  }
}
