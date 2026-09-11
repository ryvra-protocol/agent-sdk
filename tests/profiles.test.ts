import { describe, expect, it } from 'vitest';
import {
  ValidationError,
  buildMarketOpenPositionIntent,
  buildPayIntent,
  buildProcurementVendorPaymentIntent,
  buildSettlementReconciliationTransferIntent,
  buildTreasuryPayoutIntent,
  handleGatewayDecision,
  normalizeGatewayDecision,
  validateAutonomousProfileConfig,
  validateProfileIntent,
} from '../src/index.js';

const expiresSoon = () => new Date(Date.now() + 5 * 60_000).toISOString();

const treasuryConfig = {
  profileType: 'TREASURY' as const,
  autonomyLevel: 'A2' as const,
  actionAllowlist: ['PAY', 'REBALANCE'],
  spendLimits: { perTransaction: { USD: '1000.00' }, perWindow: [{ maxAmount: '10000.00', windowMs: 3_600_000, currency: 'USD' }] },
  rateLimits: [{ maxRequests: 10, windowMs: 60_000, action: 'PAY' as const }],
  escalationThresholds: { reviewAmount: '500.00' },
  requiredAuthorityRefs: {
    mandateId: 'mandate-treasury-1',
    policyVersion: '2026-09',
  },
  timeoutDefaults: { submitMs: 1_000, statusMs: 1_000, approvalMs: 1_000 },
  maxExpiryWindowMs: 10 * 60_000,
} satisfies import('../src/index.js').AutonomousProfileConfig;

const portfolioConfig = {
  profileType: 'PORTFOLIO' as const,
  autonomyLevel: 'A3' as const,
  actionAllowlist: ['REBALANCE'],
  requiredAuthorityRefs: {
    mandateId: 'mandate-portfolio-1',
    policyVersion: '2026-09',
    riskAssessmentId: 'risk-portfolio-1',
  },
} satisfies import('../src/index.js').AutonomousProfileConfig;

describe('autonomous profile support', () => {
  it('validates profile config schema', () => {
    expect(validateAutonomousProfileConfig(treasuryConfig).profileType).toBe('TREASURY');
    expect(() => validateAutonomousProfileConfig({
      ...treasuryConfig,
      actionAllowlist: ['OPEN_POSITION'],
    })).toThrowError(ValidationError);
  });

  it('builds canonical profile intents', () => {
    const treasuryIntent = buildTreasuryPayoutIntent({
      intentId: 'intent-treasury-payout-1',
      actorId: 'agent-treasury-1',
      assetId: 'USD',
      amount: { value: '125.00', currency: 'USD' },
      recipientId: 'vendor-1',
      purpose: 'Treasury payout',
      policyVersion: '2026-09',
      correlationId: 'corr-treasury-payout-1',
      expiresAt: expiresSoon(),
      mandateId: 'mandate-treasury-1',
      chainId: 'eip155:1',
    });

    expect(treasuryIntent.profileType).toBe('TREASURY');
    expect(treasuryIntent.amount?.value).toBe('125.00');
    expect(treasuryIntent.recipient).toBe('vendor-1');
    expect(treasuryIntent.chainId).toBe('eip155:1');

    const marketIntent = buildMarketOpenPositionIntent({
      intentId: 'intent-market-open-1',
      actorId: 'agent-market-1',
      assetId: 'BTC',
      amount: { value: '0.5', currency: 'BTC' },
      instrumentId: 'BTC-PERP',
      side: 'LONG',
      purpose: 'Open position',
      policyVersion: '2026-09',
      correlationId: 'corr-market-open-1',
      expiresAt: expiresSoon(),
      mandateId: 'mandate-market-1',
      venue: 'deribit',
    });

    expect(marketIntent.profileType).toBe('MARKET');
    expect(marketIntent.venue).toBe('deribit');

    const settlementIntent = buildSettlementReconciliationTransferIntent({
      intentId: 'intent-settlement-transfer-1',
      actorId: 'agent-settlement-1',
      assetId: 'USDC',
      amount: { value: '2500', currency: 'USDC' },
      destinationAccountId: 'acct-clearing',
      purpose: 'Reconcile settlement',
      policyVersion: '2026-09',
      correlationId: 'corr-settlement-transfer-1',
      expiresAt: expiresSoon(),
      mandateId: 'mandate-settlement-1',
    });

    expect(settlementIntent.recipient).toBe('acct-clearing');
  });

  it('enforces correlation and idempotency on profile validation', () => {
    const intent = buildPayIntent({
      intentId: 'intent-pay-manual-1',
      actorId: 'agent-pay-1',
      assetId: 'USD',
      amount: { value: '10.00', currency: 'USD' },
      recipientId: 'vendor-1',
      purpose: 'Payment',
      policyVersion: '2026-09',
      correlationId: 'corr-pay-manual-1',
      expiresAt: expiresSoon(),
      mandateId: 'mandate-treasury-1',
      profileType: 'TREASURY',
    });

    expect(() => validateProfileIntent(treasuryConfig, {
      ...intent,
      idempotencyKey: '',
    })).toThrowError(ValidationError);
    expect(() => validateProfileIntent(treasuryConfig, {
      ...intent,
      correlationId: '',
    })).toThrowError(ValidationError);
  });

  it('enforces max expiry windows for profile submissions', () => {
    const intent = buildProcurementVendorPaymentIntent({
      intentId: 'intent-procurement-pay-1',
      actorId: 'agent-procurement-1',
      assetId: 'USD',
      amount: { value: '75.00', currency: 'USD' },
      recipientId: 'vendor-2',
      purpose: 'Vendor payment',
      policyVersion: '2026-09',
      correlationId: 'corr-procurement-pay-1',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      mandateId: 'mandate-treasury-1',
      profileType: 'TREASURY',
    });

    expect(() => validateProfileIntent(treasuryConfig, intent)).toThrowError(ValidationError);
  });

  it('requires risk linkage where applicable and emits deterministic warnings elsewhere', () => {
    const rebalanceIntent = {
      ...buildSettlementReconciliationTransferIntent({
        intentId: 'intent-settle-1',
        actorId: 'agent-settle-1',
        assetId: 'USD',
        amount: { value: '25.00', currency: 'USD' },
        destinationAccountId: 'acct-1',
        purpose: 'Settle transfer',
        policyVersion: '2026-09',
        correlationId: 'corr-settle-1',
        expiresAt: expiresSoon(),
        mandateId: 'mandate-treasury-1',
      }),
      profileType: 'SETTLEMENT' as const,
    };

    const warnings = validateProfileIntent({
      ...treasuryConfig,
      profileType: 'SETTLEMENT',
      actionAllowlist: ['TRANSFER'],
    }, rebalanceIntent).warnings;
    expect(warnings[0]?.code).toBe('RISK_LINKAGE_RECOMMENDED');

    expect(() => validateProfileIntent({
      ...portfolioConfig,
      requiredAuthorityRefs: {
        mandateId: 'mandate-portfolio-1',
        policyVersion: '2026-09',
      },
    }, {
      ...buildMarketOpenPositionIntent({
        intentId: 'intent-market-risk-1',
        actorId: 'agent-market-risk-1',
        assetId: 'BTC',
        amount: { value: '0.1', currency: 'BTC' },
        instrumentId: 'BTC-PERP',
        side: 'LONG',
        purpose: 'Portfolio position',
        policyVersion: '2026-09',
        correlationId: 'corr-market-risk-1',
        expiresAt: expiresSoon(),
        mandateId: 'mandate-portfolio-1',
      }),
      profileType: 'PORTFOLIO',
      action: 'REBALANCE',
    })).toThrowError(ValidationError);
  });

  it('normalizes and handles escalation decisions', async () => {
    const decision = normalizeGatewayDecision({
      intentId: 'intent-review-1',
      status: 'REVIEW',
      reasonCode: 'REQUIRES_MANAGER',
      correlationId: 'corr-review-1',
    });

    expect(decision.humanActionRequired).toBe(true);
    await expect(handleGatewayDecision(decision, {
      onReview: async ({ reasonCode }) => reasonCode,
    })).resolves.toBe('REQUIRES_MANAGER');
  });

  it('keeps legacy builders compatible while adding canonical fields', () => {
    const intent = buildPayIntent({
      intentId: 'intent-legacy-1',
      actorId: 'agent-legacy-1',
      assetId: 'USD',
      amount: { value: '15.00', currency: 'USD' },
      recipientId: 'vendor-legacy-1',
      purpose: 'Legacy payment',
      policyVersion: '2026-09',
      correlationId: 'corr-legacy-1',
      expiresAt: expiresSoon(),
      mandateId: 'mandate-legacy-1',
    });

    expect(intent.details.amount.value).toBe('15.00');
    expect(intent.amount?.currency).toBe('USD');
    expect(intent.recipient).toBe('vendor-legacy-1');
  });
});
