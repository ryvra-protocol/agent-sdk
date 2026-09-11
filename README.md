# agent-sdk

`agent-sdk` is the Ryvra developer integration layer for building payment, trading, treasury, procurement, risk, settlement, and portfolio agents.

## Philosophy

Generate intent, never bypass authority.

This SDK only helps agents construct typed `FinancialIntent` payloads, apply local safety checks, and submit agent-originated execution workflows through `agent-gateway`. It does **not** expose direct blockchain execution, owner-wallet signing, or direct execution calls to accounts, pay, or markets services.

## Features

- Gateway-only `AgentGatewayClient`
- Typed builders for `PAY`, `TRANSFER`, `SWAP`, `TRADE`, `REBALANCE`, `COLLECT`, `OPEN_POSITION`, `CLOSE_POSITION`
- Safe defaults for idempotency, timeouts, retries, request signing, and log redaction
- Typed gateway error mapping with machine-readable `reasonCode`, `intentId`, and `correlationId`
- Provenance helpers for trace construction and audit timeline normalization
- Read-only mandate and policy/risk helpers

## Installation

```bash
npm install @ryvra/agent-sdk
```

## Quickstart

```ts
import { AgentGatewayClient, buildPayIntent } from '@ryvra/agent-sdk';

const client = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'agent-dev',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const intent = buildPayIntent({
  intentId: 'intent-pay-001',
  actorId: 'agent-payments-01',
  assetId: 'USD',
  amount: { value: '1250.00', currency: 'USD' },
  recipientId: 'vendor-44',
  purpose: 'Invoice settlement',
  policyVersion: '2026-09',
  correlationId: 'corr-1001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
  mandateId: 'mandate-ops-01',
});

await client.submitIntent(intent, {
  knownCapabilities: ['PAY'],
  softLimit: '5000',
});
```

## Supported intent builders

- `buildPayIntent`
- `buildTransferIntent`
- `buildSwapIntent`
- `buildTradeIntent`
- `buildRebalanceIntent`
- `buildCollectIntent`
- `buildOpenPositionIntent`
- `buildClosePositionIntent`

See `/docs/intent-builders.md` for field requirements.

## Gateway client

Primary execution workflow methods:

- `submitIntent(intent)`
- `getIntent(intentId)`
- `approveIntent(intentId, approvalPayload)`
- `cancelIntent(intentId)`
- `getAgentStatus(agentId)`
- `suspendAgent(agentId)`
- `getAuditEvents(filters)`

Read-only supporting APIs are available under:

- `client.mandates`
- `client.policyRisk`
- `client.audit`
- `client.agents`

## Error handling

Gateway responses map to typed errors:

- `AuthenticationError`
- `AuthorizationError`
- `PolicyDeniedError`
- `RiskDeniedError`
- `CapabilityMismatchError`
- `RateLimitError`
- `ReplayDetectedError`
- `ValidationError`
- `GatewayUnavailableError`

Each error carries machine-readable metadata when present:

- `reasonCode`
- `intentId`
- `correlationId`

```ts
import { PolicyDeniedError } from '@ryvra/agent-sdk';

try {
  await client.submitIntent(intent);
} catch (error) {
  if (error instanceof PolicyDeniedError) {
    console.error(error.reasonCode, error.intentId, error.correlationId);
  }
}
```

## Provenance tracing

```ts
import { traceFromIntent } from '@ryvra/agent-sdk';

const trace = traceFromIntent(intent.intentId);
const timeline = await client.audit.getCorrelationTimeline(intent.correlationId);
```

## Examples

- `/examples/payment-agent.ts`
- `/examples/treasury-rebalance.ts`
- `/examples/market-order.ts`

All examples demonstrate gateway-only submission.

## RFC mapping

This SDK aligns with the following dependencies:

- RFC-0005: Financial intent schema and validation
- RFC-0006: Agent gateway submission contracts
- RFC-0007: Policy and risk authority flow
- RFC-0008: Audit and provenance timelines

## Docs

- `/docs/quickstart.md`
- `/docs/security-model.md`
- `/docs/intent-builders.md`
