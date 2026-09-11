import { AgentGatewayClient, buildTradeIntent } from '../src/index.js';

export async function runMarketOrderIntentExample() {
  const client = new AgentGatewayClient({
    baseUrl: 'https://agent-gateway.ryvra.example',
    auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
    signing: {
      keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'market-agent',
      secret: process.env.RYVRA_SIGNING_SECRET ?? '',
    },
  });

  const intent = buildTradeIntent({
    intentId: 'intent-trade-demo',
    actorId: 'agent-market-demo',
    assetId: 'BTC',
    amount: { value: '0.5', currency: 'BTC' },
    instrumentId: 'BTC-USD-SPOT',
    side: 'BUY',
    orderType: 'MARKET',
    purpose: 'Strategy market entry',
    policyVersion: '2026-09',
    correlationId: 'corr-trade-demo',
    expiresAt: new Date(Date.now() + 300_000),
    mandateId: 'mandate-market-001',
  });

  return client.submitIntent(intent, { knownCapabilities: ['TRADE'], softLimit: '1' });
}
