import { AgentGatewayClient, buildRebalanceIntent } from '../src/index.js';

export async function runTreasuryRebalancingAgent() {
  const client = new AgentGatewayClient({
    baseUrl: 'https://agent-gateway.ryvra.example',
    auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
    signing: {
      keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'treasury-agent',
      secret: process.env.RYVRA_SIGNING_SECRET ?? '',
    },
  });

  const intent = buildRebalanceIntent({
    intentId: 'intent-rebalance-demo',
    actorId: 'agent-treasury-demo',
    assetId: 'TREASURY_BASKET',
    amount: { value: '50000', currency: 'USD' },
    targetAllocation: { USD: 40, USDC: 35, USTB: 25 },
    purpose: 'Treasury allocation rebalance',
    policyVersion: '2026-09',
    correlationId: 'corr-rebalance-demo',
    expiresAt: new Date(Date.now() + 300_000),
    mandateId: 'mandate-treasury-001',
  });

  return client.submitIntent(intent, { knownCapabilities: ['REBALANCE'], softLimit: '100000' });
}
