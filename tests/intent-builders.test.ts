import { describe, expect, it } from 'vitest';
import {
  buildPayIntent,
  buildOpenPositionIntent,
  buildTradeIntent,
  buildClosePositionIntent,
  createIdempotencyKey,
  ensureWithinSoftLimit,
  normalizeAuditEvents,
  traceFromIntent,
  ValidationError,
} from '../src/index.js';

const baseFields = {
  intentId: 'intent-001',
  actorId: 'agent-01',
  assetId: 'USD',
  purpose: 'Test payment',
  policyVersion: '2026-09',
  correlationId: 'corr-001',
  expiresAt: '2026-09-12T00:00:00.000Z',
  mandateId: 'mandate-01',
};

describe('intent builders', () => {
  it('enforces required base fields', () => {
    expect(() => buildPayIntent({
      ...baseFields,
      mandateId: '',
      amount: { value: '10.00', currency: 'USD' },
      recipientId: 'vendor-1',
    })).toThrowError(ValidationError);
  });

  it('serializes enum actions as strings', () => {
    const intent = buildTradeIntent({
      ...baseFields,
      assetId: 'BTC',
      amount: { value: '0.25', currency: 'BTC' },
      instrumentId: 'BTC-USD',
      side: 'BUY',
    });

    expect(JSON.parse(JSON.stringify(intent)).action).toBe('TRADE');
  });

  it('auto-generates idempotency keys when omitted', () => {
    const intent = buildPayIntent({
      ...baseFields,
      amount: { value: '10.00', currency: 'USD' },
      recipientId: 'vendor-1',
    });

    expect(intent.idempotencyKey).toMatch(/^pay_/);
    expect(createIdempotencyKey('pay')).toMatch(/^pay_/);
  });

  it('exposes provenance helpers', () => {
    expect(traceFromIntent('intent-123').traceparent).toMatch(/^00-[0-9a-f]{32}-0000000000000001-01$/);
    expect(normalizeAuditEvents([
      {
        eventId: '2',
        correlationId: 'corr-1',
        intentId: 'intent-1',
        type: 'B',
        timestamp: '2026-09-11T01:00:00.000Z',
      },
      {
        eventId: '1',
        correlationId: 'corr-1',
        intentId: 'intent-1',
        type: 'A',
        timestamp: '2026-09-11T00:00:00.000Z',
      },
    ])[0]?.label).toBe('A');
  });

  it('preserves decimal precision for soft-limit checks', () => {
    const intent = buildPayIntent({
      ...baseFields,
      amount: { value: '1000000000000000000.0000000001', currency: 'USD' },
      recipientId: 'vendor-1',
    });

    expect(() => ensureWithinSoftLimit(intent, '1000000000000000000.0000000000')).toThrowError(ValidationError);
  });

  it('fails closed for malformed soft-limit values', () => {
    const intent = buildPayIntent({
      ...baseFields,
      amount: { value: '10.00', currency: 'USD' },
      recipientId: 'vendor-1',
    });

    expect(() => ensureWithinSoftLimit(intent, 'oops')).toThrowError(ValidationError);
  });

  it('enforces action-specific runtime enums', () => {
    expect(() => buildOpenPositionIntent({
      ...baseFields,
      assetId: 'BTC',
      amount: { value: '1', currency: 'BTC' },
      instrumentId: 'BTC-PERP',
      side: 'BUY' as never,
    })).toThrowError(ValidationError);
  });

  it('fails closed when a soft limit is supplied for a non-amount intent', () => {
    const intent = buildClosePositionIntent({
      ...baseFields,
      assetId: 'BTC',
      positionId: 'pos-1',
    });

    expect(() => ensureWithinSoftLimit(intent, '10')).toThrowError(ValidationError);
  });
});
