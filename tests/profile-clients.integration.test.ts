import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AgentGatewayClient,
  MarketProfileClient,
  PortfolioProfileClient,
  ProcurementProfileClient,
  SettlementProfileClient,
  TreasuryProfileClient,
} from '../src/index.js';
import { startMockGateway } from './helpers/mock-gateway.js';

const createClient = (baseUrl: string) => new AgentGatewayClient({
  baseUrl,
  auth: 'gateway-test-token',
  signing: { keyId: 'test-key', secret: 'test-secret' },
  timeoutMs: 1_000,
  retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
});

const expiresSoon = () => new Date(Date.now() + 5 * 60_000).toISOString();

describe('autonomous profile clients', () => {
  let gateway: Awaited<ReturnType<typeof startMockGateway>>;

  beforeEach(async () => {
    gateway = await startMockGateway();
  });

  afterEach(async () => {
    await gateway.close();
  });

  it('supports successful submit/get flow across all profile clients', async () => {
    const client = createClient(gateway.baseUrl);
    const treasury = new TreasuryProfileClient(client, {
      autonomyLevel: 'A2',
      actionAllowlist: ['PAY', 'REBALANCE'],
      spendLimits: { perTransaction: { USD: '1000', TREASURY_BASKET: '50000' } },
      requiredAuthorityRefs: { mandateId: 'mandate-treasury', policyVersion: '2026-09' },
    });
    const portfolio = new PortfolioProfileClient(client, {
      autonomyLevel: 'A3',
      actionAllowlist: ['REBALANCE'],
      requiredAuthorityRefs: { mandateId: 'mandate-portfolio', policyVersion: '2026-09', riskAssessmentId: 'risk-portfolio' },
    });
    const procurement = new ProcurementProfileClient(client, {
      autonomyLevel: 'A1',
      actionAllowlist: ['PAY'],
      spendLimits: { perTransaction: { USD: '500' } },
      requiredAuthorityRefs: { mandateId: 'mandate-procurement', policyVersion: '2026-09', authorizationId: 'auth-procurement' },
    });
    const market = new MarketProfileClient(client, {
      autonomyLevel: 'A3',
      actionAllowlist: ['OPEN_POSITION', 'CLOSE_POSITION'],
      requiredAuthorityRefs: { mandateId: 'mandate-market', policyVersion: '2026-09', riskAssessmentId: 'risk-market' },
    });
    const settlement = new SettlementProfileClient(client, {
      autonomyLevel: 'A2',
      actionAllowlist: ['TRANSFER'],
      spendLimits: { perTransaction: { USDC: '5000' } },
      requiredAuthorityRefs: { mandateId: 'mandate-settlement', policyVersion: '2026-09' },
    });

    const treasuryResult = await treasury.submitPayoutIntent({
      intentId: 'intent-treasury-submit-1',
      actorId: 'agent-treasury-submit-1',
      assetId: 'USD',
      amount: { value: '125.00', currency: 'USD' },
      recipientId: 'vendor-1',
      purpose: 'Treasury payout',
      correlationId: 'corr-treasury-submit-1',
      expiresAt: expiresSoon(),
    });
    expect(treasuryResult.accepted).toBe(true);
    expect((await treasury.getIntentDecision('intent-treasury-submit-1')).status).toBe('PENDING');

    const portfolioResult = await portfolio.submitRebalanceIntent({
      intentId: 'intent-portfolio-submit-1',
      actorId: 'agent-portfolio-submit-1',
      assetId: 'PORTFOLIO_BASKET',
      amount: { value: '1000', currency: 'USD' },
      targetAllocation: { USD: 40, BTC: 60 },
      purpose: 'Portfolio rebalance',
      correlationId: 'corr-portfolio-submit-1',
      expiresAt: expiresSoon(),
    });
    expect(portfolioResult.accepted).toBe(true);

    const procurementResult = await procurement.submitVendorPaymentIntent({
      intentId: 'intent-procurement-submit-1',
      actorId: 'agent-procurement-submit-1',
      assetId: 'USD',
      amount: { value: '75.00', currency: 'USD' },
      recipientId: 'vendor-2',
      purpose: 'Procurement payment',
      correlationId: 'corr-procurement-submit-1',
      expiresAt: expiresSoon(),
    });
    expect(procurementResult.warnings).toHaveLength(0);

    const marketResult = await market.submitOpenPositionIntent({
      intentId: 'intent-market-submit-1',
      actorId: 'agent-market-submit-1',
      assetId: 'BTC',
      amount: { value: '0.25', currency: 'BTC' },
      instrumentId: 'BTC-PERP',
      side: 'LONG',
      purpose: 'Market entry',
      correlationId: 'corr-market-submit-1',
      expiresAt: expiresSoon(),
      venue: 'deribit',
    });
    expect(marketResult.intent.venue).toBe('deribit');

    const settlementResult = await settlement.submitReconciliationTransferIntent({
      intentId: 'intent-settlement-submit-1',
      actorId: 'agent-settlement-submit-1',
      assetId: 'USDC',
      amount: { value: '2500', currency: 'USDC' },
      destinationAccountId: 'acct-clearing',
      purpose: 'Settlement reconciliation',
      correlationId: 'corr-settlement-submit-1',
      expiresAt: expiresSoon(),
    });
    expect(settlementResult.accepted).toBe(true);
  });

  it('handles review challenge delay and quarantine decisions with callbacks', async () => {
    const client = createClient(gateway.baseUrl);
    const treasury = new TreasuryProfileClient(client, {
      autonomyLevel: 'A2',
      actionAllowlist: ['PAY'],
      spendLimits: { perTransaction: { USD: '1000' } },
      requiredAuthorityRefs: { mandateId: 'mandate-treasury', policyVersion: '2026-09' },
    });

    for (const status of ['REVIEW', 'CHALLENGE', 'DELAY', 'QUARANTINE'] as const) {
      const intentId = `intent-${status.toLowerCase()}-1`;
      await treasury.submitPayoutIntent({
        intentId,
        actorId: 'agent-treasury-escalation-1',
        assetId: 'USD',
        amount: { value: '25.00', currency: 'USD' },
        recipientId: 'vendor-escalation',
        purpose: `Escalation ${status}`,
        correlationId: `corr-${status.toLowerCase()}-1`,
        expiresAt: expiresSoon(),
        metadata: { mockStatus: status, mockReasonCode: `${status}_REASON` },
      });

      await expect(treasury.handleIntentDecision(intentId, {
        onReview: ({ reasonCode }) => reasonCode,
        onChallenge: ({ reasonCode }) => reasonCode,
        onDelay: ({ reasonCode }) => reasonCode,
        onQuarantine: ({ reasonCode }) => reasonCode,
      })).resolves.toBe(`${status}_REASON`);
    }
  });

  it('surfaces deny and block reason codes and provenance summaries', async () => {
    const client = createClient(gateway.baseUrl);
    const settlement = new SettlementProfileClient(client, {
      autonomyLevel: 'A2',
      actionAllowlist: ['TRANSFER'],
      spendLimits: { perTransaction: { USDC: '5000' } },
      requiredAuthorityRefs: { mandateId: 'mandate-settlement', policyVersion: '2026-09' },
    });

    await settlement.submitReconciliationTransferIntent({
      intentId: 'intent-denied-1',
      actorId: 'agent-settlement-denied-1',
      assetId: 'USDC',
      amount: { value: '50', currency: 'USDC' },
      destinationAccountId: 'acct-review',
      purpose: 'Denied settlement transfer',
      correlationId: 'corr-denied-1',
      expiresAt: expiresSoon(),
      metadata: { mockStatus: 'DENIED', mockReasonCode: 'POLICY_ESCALATED_DENIAL' },
    });

    const decision = await settlement.getIntentDecision('intent-denied-1');
    expect(decision.status).toBe('DENIED');
    expect(decision.reasonCode).toBe('POLICY_ESCALATED_DENIAL');

    const auditTimeline = await settlement.getAuditTimelineByIntentId('intent-denied-1');
    expect(auditTimeline).toHaveLength(2);

    const traces = await settlement.getDecisionTraceByCorrelationId('corr-denied-1');
    expect(traces[1]?.status).toBe('DENIED');

    const summary = await settlement.summarizeOutcomesByCorrelationId('corr-denied-1');
    expect(summary.byStatus.DENIED).toBe(1);
    expect(summary.byProfile.SETTLEMENT).toBe(1);
  });
});
