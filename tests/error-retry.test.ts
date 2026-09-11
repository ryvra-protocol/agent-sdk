import { describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  AuthorizationError,
  GatewayUnavailableError,
  PolicyDeniedError,
  RateLimitError,
  ReplayDetectedError,
  ValidationError,
  executeWithRetry,
  mapGatewayError,
  redactSensitiveFields,
} from '../src/index.js';

describe('error mapping', () => {
  it('maps gateway responses to typed errors', () => {
    expect(mapGatewayError(403, { reasonCode: 'POLICY_DENIED' })).toBeInstanceOf(PolicyDeniedError);
    expect(mapGatewayError(429, { reasonCode: 'RATE_LIMITED' })).toBeInstanceOf(RateLimitError);
    expect(mapGatewayError(409, { reasonCode: 'REPLAY_DETECTED' })).toBeInstanceOf(ReplayDetectedError);
    expect(mapGatewayError(401, { reasonCode: 'AUTH' })).toBeInstanceOf(AuthenticationError);
    expect(mapGatewayError(422, { reasonCode: 'INVALID' })).toBeInstanceOf(ValidationError);
    expect(mapGatewayError(503, { reasonCode: 'UNAVAILABLE' })).toBeInstanceOf(GatewayUnavailableError);
  });
});

describe('retry policy', () => {
  it('retries transient gateway errors', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new GatewayUnavailableError('temporary outage', { status: 503 }))
      .mockResolvedValueOnce('ok');

    await expect(executeWithRetry(() => operation(), { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry authorization denials', async () => {
    const operation = vi.fn().mockRejectedValue(new AuthorizationError('forbidden', { status: 403 }));

    await expect(executeWithRetry(() => operation(), { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 })).rejects.toBeInstanceOf(AuthorizationError);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('logging redaction', () => {
  it('redacts sensitive fields from logs', () => {
    expect(redactSensitiveFields({
      authorization: '******',
      nested: { signature: 'abc123', keep: 'ok' },
    })).toEqual({
      authorization: '[REDACTED]',
      nested: { signature: '[REDACTED]', keep: 'ok' },
    });
  });
});
