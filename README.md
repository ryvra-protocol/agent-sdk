# agent-sdk

`agent-sdk` is the Ryvra developer integration layer for autonomous treasury, portfolio, procurement, market, and settlement agents.

## Philosophy

Generate intent, never bypass authority.

This SDK only helps agents construct typed `FinancialIntent` payloads, apply local safety checks, and submit agent-originated execution workflows through `agent-gateway`. It does **not** expose direct blockchain execution, owner-wallet signing, or direct execution calls to accounts, pay, or markets services.

## Features

- Gateway-only `AgentGatewayClient`
- Typed autonomous profile clients for treasury, portfolio, procurement, market, and settlement agents
- Canonical financial intent builders with `actorType=AGENT`, correlation, idempotency, mandate, policy, expiry, and profile metadata
- Governance-safe validation for action allowlists, mandate/policy linkage, bounded expiry windows, per-transaction spend limits, and risk/authorization linkage checks
- Typed escalation decision handling for `REVIEW`, `CHALLENGE`, `DELAY`, `QUARANTINE`, `DENIED`, and `BLOCKED`
- Provenance helpers for audit timelines, gateway decision traces, and outcome summaries
- Typed gateway error mapping with machine-readable `reasonCode`, `intentId`, and `correlationId`

## Installation

```bash
npm install @ryvra/agent-sdk
```

## Profile-based architecture

### Shared building blocks

- `AgentGatewayClient` for gateway submission, lookup, approval, and cancellation workflows
- `validateAutonomousProfileConfig` and `validateProfileIntent` for deterministic local validation
- `handleGatewayDecision` and `normalizeGatewayDecision` for escalation workflows
- `traceFromIntent`, `normalizeGatewayDecisionEvents`, and `summarizeRunOutcomes` for provenance

### Profile clients

- `TreasuryProfileClient`
- `PortfolioProfileClient`
- `ProcurementProfileClient`
- `MarketProfileClient`
- `SettlementProfileClient`

Each profile client exposes:

- validated `profileConfig`
- `allowedActions` and `supportsAction()` helpers
- `validateIntent()` pre-submit validation
- profile-specific build/submit wrappers
- gateway decision and audit timeline helpers

## Gateway-only trust boundary

Execution-facing public APIs are limited to:

- `submitIntent(intent)`
- `getIntent(intentId)`
- `approveIntent(intentId, approvalPayload)`
- `cancelIntent(intentId)`
- `getAuditEvents(filters)`

The SDK intentionally blocks non-gateway execution paths and does not export blockchain RPC, custody, wallet, or direct pay/markets/accounts execution helpers.

## Quickstarts

### Treasury

```ts
import { AgentGatewayClient, TreasuryProfileClient } from '@ryvra/agent-sdk';

const gateway = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'treasury-agent',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const treasury = new TreasuryProfileClient(gateway, {
  autonomyLevel: 'A2',
  actionAllowlist: ['PAY', 'REBALANCE'],
  spendLimits: { perTransaction: { USD: '5000.00' } },
  requiredAuthorityRefs: {
    mandateId: 'mandate-treasury-001',
    policyVersion: '2026-09',
  },
});

await treasury.submitPayoutIntent({
  intentId: 'intent-treasury-payout-001',
  actorId: 'agent-treasury-01',
  assetId: 'USD',
  amount: { value: '1250.00', currency: 'USD' },
  recipientId: 'vendor-44',
  purpose: 'Treasury payout',
  correlationId: 'corr-1001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
});
```

### Portfolio

```ts
import { AgentGatewayClient, PortfolioProfileClient } from '@ryvra/agent-sdk';

const gateway = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'portfolio-agent',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const portfolio = new PortfolioProfileClient(gateway, {
  autonomyLevel: 'A3',
  actionAllowlist: ['REBALANCE'],
  requiredAuthorityRefs: {
    mandateId: 'mandate-portfolio-001',
    policyVersion: '2026-09',
    riskAssessmentId: 'risk-portfolio-001',
  },
});

await portfolio.submitRebalanceIntent({
  intentId: 'intent-portfolio-rebalance-001',
  actorId: 'agent-portfolio-01',
  assetId: 'PORTFOLIO_BASKET',
  amount: { value: '100000', currency: 'USD' },
  targetAllocation: { USD: 50, BTC: 25, ETH: 25 },
  purpose: 'Portfolio rebalance',
  correlationId: 'corr-portfolio-001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
});
```

### Procurement

```ts
import { AgentGatewayClient, ProcurementProfileClient } from '@ryvra/agent-sdk';

const gateway = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'procurement-agent',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const procurement = new ProcurementProfileClient(gateway, {
  autonomyLevel: 'A1',
  actionAllowlist: ['PAY'],
  spendLimits: { perTransaction: { USD: '1000.00' } },
  requiredAuthorityRefs: {
    mandateId: 'mandate-procurement-001',
    policyVersion: '2026-09',
    authorizationId: 'auth-procurement-001',
  },
});

await procurement.submitVendorPaymentIntent({
  intentId: 'intent-procurement-payment-001',
  actorId: 'agent-procurement-01',
  assetId: 'USD',
  amount: { value: '320.00', currency: 'USD' },
  recipientId: 'vendor-17',
  purpose: 'Vendor payment',
  correlationId: 'corr-procurement-001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
});
```

### Market

```ts
import { AgentGatewayClient, MarketProfileClient } from '@ryvra/agent-sdk';

const gateway = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'market-agent',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const market = new MarketProfileClient(gateway, {
  autonomyLevel: 'A3',
  actionAllowlist: ['OPEN_POSITION', 'CLOSE_POSITION'],
  requiredAuthorityRefs: {
    mandateId: 'mandate-market-001',
    policyVersion: '2026-09',
    riskAssessmentId: 'risk-market-001',
  },
});

await market.submitOpenPositionIntent({
  intentId: 'intent-market-open-001',
  actorId: 'agent-market-01',
  assetId: 'BTC',
  amount: { value: '0.5', currency: 'BTC' },
  instrumentId: 'BTC-PERP',
  side: 'LONG',
  venue: 'deribit',
  purpose: 'Open market position',
  correlationId: 'corr-market-001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
});
```

### Settlement

```ts
import { AgentGatewayClient, SettlementProfileClient } from '@ryvra/agent-sdk';

const gateway = new AgentGatewayClient({
  baseUrl: 'https://agent-gateway.ryvra.example',
  auth: async () => process.env.RYVRA_GATEWAY_TOKEN ?? '',
  signing: {
    keyId: process.env.RYVRA_SIGNING_KEY_ID ?? 'settlement-agent',
    secret: process.env.RYVRA_SIGNING_SECRET ?? '',
  },
});

const settlement = new SettlementProfileClient(gateway, {
  autonomyLevel: 'A2',
  actionAllowlist: ['TRANSFER'],
  spendLimits: { perTransaction: { USDC: '50000.00' } },
  requiredAuthorityRefs: {
    mandateId: 'mandate-settlement-001',
    policyVersion: '2026-09',
  },
});

await settlement.submitReconciliationTransferIntent({
  intentId: 'intent-settlement-transfer-001',
  actorId: 'agent-settlement-01',
  assetId: 'USDC',
  amount: { value: '15000.00', currency: 'USDC' },
  destinationAccountId: 'acct-clearing-usdc',
  purpose: 'Settlement reconciliation transfer',
  correlationId: 'corr-settlement-001',
  expiresAt: new Date(Date.now() + 5 * 60_000),
});
```

## Canonical financial intent templates

- `buildTreasuryPayoutIntent`
- `buildTreasuryRebalanceIntent`
- `buildPortfolioRebalanceIntent`
- `buildProcurementVendorPaymentIntent`
- `buildMarketOpenPositionIntent`
- `buildMarketClosePositionIntent`
- `buildSettlementReconciliationTransferIntent`

Canonical `FinancialIntent` objects include:

- `intentId`
- `actorType=AGENT`
- `actorId`
- `action`
- `assetId`
- `amount` when applicable
- `chainId` when applicable
- `recipient` when applicable
- `venue` when applicable
- `purpose`
- `mandateId`
- `policyVersion`
- `correlationId`
- `idempotencyKey`
- `expiresAt`

## Escalation handling

```ts
const decision = await treasury.getIntentDecision('intent-treasury-payout-001');

await treasury.handleIntentDecision('intent-treasury-payout-001', {
  onReview: ({ reasonCode }) => notifyHumanReviewer(reasonCode),
  onChallenge: ({ reasonCode }) => openCase(reasonCode),
  onDelay: ({ reasonCode }) => reschedule(reasonCode),
  onQuarantine: ({ reasonCode }) => quarantineRun(reasonCode),
  onDenied: ({ reasonCode }) => failRun(reasonCode),
  onBlocked: ({ reasonCode }) => alertSecurity(reasonCode),
});
```

## Provenance queries

```ts
const timeline = await treasury.getAuditTimelineByIntentId('intent-treasury-payout-001');
const traces = await treasury.getDecisionTraceByCorrelationId('corr-1001');
const summary = await treasury.summarizeOutcomesByCorrelationId('corr-1001');
```

## Existing low-level builders

- `buildPayIntent`
- `buildTransferIntent`
- `buildSwapIntent`
- `buildTradeIntent`
- `buildRebalanceIntent`
- `buildCollectIntent`
- `buildOpenPositionIntent`
- `buildClosePositionIntent`

## RFC mapping

This SDK aligns with:

- RFC-0005: Canonical financial intent schema and validation
- RFC-0006: Agent gateway submission and workflow contracts
- RFC-0007: Policy and risk authority flow
- RFC-0008: Audit and provenance timelines
- RFC-0016: Autonomous agent profiles and governance-safe execution

## Docs

- `/docs/profile-quickstarts.md`
- `/docs/escalation-handlers.md`
- `/docs/provenance-queries.md`
- `/docs/security-boundary.md`
- `/docs/quickstart.md`
- `/docs/security-model.md`
- `/docs/intent-builders.md`
