import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AgentGatewayClient,
  PolicyDeniedError,
  ReplayDetectedError,
  ValidationError,
  buildPayIntent,
  buildTradeIntent,
} from '../src/index.js';
import { startMockGateway } from './helpers/mock-gateway.js';

const createClient = (baseUrl: string) => new AgentGatewayClient({
  baseUrl,
  auth: 'gateway-test-token',
  signing: { keyId: 'test-key', secret: 'test-secret' },
  timeoutMs: 1_000,
  retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
});

const baseFields = {
  intentId: 'intent-integration-1',
  actorId: 'agent-int-1',
  assetId: 'USD',
  purpose: 'Integration payment',
  policyVersion: '2026-09',
  correlationId: 'corr-integration-1',
  expiresAt: '2026-09-12T00:00:00.000Z',
  mandateId: 'mandate-int-1',
};

describe('AgentGatewayClient integration', () => {
  let gateway: Awaited<ReturnType<typeof startMockGateway>>;

  beforeEach(async () => {
    gateway = await startMockGateway();
  });

  afterEach(async () => {
    await gateway.close();
  });

  it('supports submit, get, approve, cancel, and audit flows through the gateway', async () => {
    const client = createClient(gateway.baseUrl);
    const intent = buildPayIntent({
      ...baseFields,
      amount: { value: '15.00', currency: 'USD' },
      recipientId: 'vendor-1',
    });

    await expect(client.submitIntent(intent, { knownCapabilities: ['PAY'], softLimit: '100' })).resolves.toMatchObject({ accepted: true });
    await expect(client.getIntent(intent.intentId)).resolves.toMatchObject({ status: 'PENDING', intent: { intentId: intent.intentId } });
    await expect(client.approveIntent(intent.intentId, { approverId: 'ops-1', decision: 'APPROVE' })).resolves.toEqual({ approved: true, intentId: intent.intentId });
    await expect(client.cancelIntent(intent.intentId)).resolves.toEqual({ cancelled: true, intentId: intent.intentId });
    await expect(client.getAgentStatus(intent.actorId)).resolves.toEqual({ agentId: intent.actorId, status: 'ACTIVE' });
    await expect(client.suspendAgent(intent.actorId)).resolves.toEqual({ suspended: true, agentId: intent.actorId });
    await expect(client.getAuditEvents({ correlationId: intent.correlationId })).resolves.toHaveLength(2);
  });

  it('maps denial paths to typed errors', async () => {
    const client = createClient(gateway.baseUrl);
    const intent = buildTradeIntent({
      ...baseFields,
      intentId: 'intent-trade-blocked',
      correlationId: 'corr-trade-blocked',
      assetId: 'BTC',
      amount: { value: '0.5', currency: 'BTC' },
      instrumentId: 'BTC-USD',
      side: 'BUY',
    });

    await expect(client.submitIntent(intent, { knownCapabilities: ['TRADE'], softLimit: '1' })).rejects.toBeInstanceOf(PolicyDeniedError);
  });

  it('detects replays using idempotency keys', async () => {
    const client = createClient(gateway.baseUrl);
    const intent = buildPayIntent({
      ...baseFields,
      intentId: 'intent-replay-1',
      correlationId: 'corr-replay-1',
      idempotencyKey: 'idem-fixed',
      amount: { value: '10.00', currency: 'USD' },
      recipientId: 'vendor-2',
    });

    await client.submitIntent(intent);
    await expect(client.submitIntent(intent)).rejects.toBeInstanceOf(ReplayDetectedError);
  });

  it('propagates correlationId and idempotency headers', async () => {
    const client = createClient(gateway.baseUrl);
    const intent = buildPayIntent({
      ...baseFields,
      intentId: 'intent-correlation-1',
      correlationId: 'corr-correlation-1',
      amount: { value: '11.00', currency: 'USD' },
      recipientId: 'vendor-3',
    });

    await client.submitIntent(intent);

    expect(gateway.state.lastRequest?.headers['x-correlation-id']).toBe(intent.correlationId);
    expect(gateway.state.lastRequest?.headers['idempotency-key']).toBe(intent.idempotencyKey);
  });

  it('enforces soft limits from the known mandate when no explicit override is provided', async () => {
    const client = createClient(gateway.baseUrl);
    const intent = buildPayIntent({
      ...baseFields,
      intentId: 'intent-mandate-soft-limit-1',
      correlationId: 'corr-mandate-soft-limit-1',
      amount: { value: '101.00', currency: 'USD' },
      recipientId: 'vendor-4',
    });

    await expect(client.submitIntent(intent, {
      mandate: {
        mandateId: intent.mandateId,
        capabilities: ['PAY'],
        softLimits: { USD: '100.00' },
      },
    })).rejects.toBeInstanceOf(ValidationError);
    expect(gateway.state.lastRequest).toBeUndefined();
  });
});
