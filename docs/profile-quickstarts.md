# Profile quickstarts

## Treasury agents

Use `TreasuryProfileClient` for treasury payouts and rebalances.
Configure `actionAllowlist`, per-transaction spend limits, mandate/policy refs, and bounded expiry windows.
Use `submitPayoutIntent` for treasury payouts and `submitRebalanceIntent` for treasury rebalances.

## Portfolio agents

Use `PortfolioProfileClient` for autonomous portfolio rebalances.
Portfolio flows should include risk linkage through `requiredAuthorityRefs.riskAssessmentId`.
Use `submitRebalanceIntent` for portfolio rebalance intents.

## Procurement agents

Use `ProcurementProfileClient` for vendor payment workflows.
Configure authorization linkage when available and use `submitVendorPaymentIntent` for procurement-originated payouts.

## Market agents

Use `MarketProfileClient` for open and close position workflows.
Market flows require risk linkage and should include a venue when applicable.
Use `submitOpenPositionIntent` and `submitClosePositionIntent`.

## Settlement agents

Use `SettlementProfileClient` for reconciliation transfers.
Use `submitReconciliationTransferIntent` and audit the resulting trace with correlation-based provenance helpers.

## Shared profile config fields

Every profile config includes:

- `profileType`
- `autonomyLevel`
- `actionAllowlist`
- `spendLimits`
- `rateLimits`
- `escalationThresholds`
- `requiredAuthorityRefs`
- `retryPolicy`
- `timeoutDefaults`
- `maxExpiryWindowMs`
