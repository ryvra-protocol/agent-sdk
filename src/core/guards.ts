import { CapabilityMismatchError, ValidationError } from './errors.js';
import type { FinancialIntent, FinancialIntentAction, KnownMandate } from './types.js';

function trimLeadingZeros(value: string): string {
  let index = 0;
  while (index < value.length - 1 && value[index] === '0') {
    index += 1;
  }

  return value.slice(index);
}

function trimTrailingZeros(value: string): string {
  let index = value.length;
  while (index > 0 && value[index - 1] === '0') {
    index -= 1;
  }

  return value.slice(0, index);
}

function normalizeDecimal(value: string): { negative: boolean; whole: string; fraction: string } | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  let cursor = 0;
  let negative = false;
  if (trimmed[cursor] === '+' || trimmed[cursor] === '-') {
    negative = trimmed[cursor] === '-';
    cursor += 1;
  }

  if (cursor >= trimmed.length) {
    return undefined;
  }

  let whole = '';
  while (cursor < trimmed.length && trimmed[cursor] >= '0' && trimmed[cursor] <= '9') {
    whole += trimmed[cursor];
    cursor += 1;
  }

  let fraction = '';
  if (cursor < trimmed.length) {
    if (trimmed[cursor] !== '.') {
      return undefined;
    }

    cursor += 1;
    while (cursor < trimmed.length && trimmed[cursor] >= '0' && trimmed[cursor] <= '9') {
      fraction += trimmed[cursor];
      cursor += 1;
    }
  }

  if (cursor !== trimmed.length || whole.length === 0) {
    return undefined;
  }

  whole = trimLeadingZeros(whole) || '0';
  fraction = trimTrailingZeros(fraction);
  return { negative, whole, fraction };
}

export function compareDecimalStrings(left: string, right: string): number | undefined {
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

  const amount = intent.amount?.value
    ?? (intent.details.amount && typeof intent.details.amount === 'object' && 'value' in intent.details.amount ? String(intent.details.amount.value) : undefined);

  if (!amount) {
    throw new ValidationError('Intent does not expose a comparable amount for soft-limit enforcement', {
      reasonCode: 'SOFT_LIMIT_UNSUPPORTED',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { action: intent.action, softLimit },
    });
  }

  const comparison = compareDecimalStrings(amount, softLimit);
  if (comparison === undefined) {
    throw new ValidationError('Intent amount or soft limit is not a valid decimal value', {
      reasonCode: 'SOFT_LIMIT_INVALID_DECIMAL',
      intentId: intent.intentId,
      correlationId: intent.correlationId,
      details: { amount, softLimit },
    });
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
