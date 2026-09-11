import { AgentGatewayClient, buildPayIntent } from '../src/index.js';

export async function runPaymentAgent() {
  const client = new AgentGatewayClient({
    baseUrl: 'https://agent-gateway.ryvra.example',
    auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
    signing: {
      keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'payment-agent',
      secret: process.env.RYVRA_SIGNING_SECRET ?? '',
    },
  });

  const intent = buildPayIntent({
    intentId: 'intent-pay-demo',
    actorId: 'agent-payment-demo',
    assetId: 'USD',
    amount: { value: '250.00', currency: 'USD' },
    recipientId: 'vendor-17',
    purpose: 'Recurring vendor payment',
    policyVersion: '2026-09',
    correlationId: 'corr-payment-demo',
    expiresAt: new Date(Date.now() + 300_000),
    mandateId: 'mandate-pay-001',
  });

  return client.submitIntent(intent, { knownCapabilities: ['PAY'], softLimit: '1000' });
}
