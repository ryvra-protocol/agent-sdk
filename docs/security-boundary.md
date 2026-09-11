# Security boundary

## Gateway-only execution

This SDK only submits intents to `agent-gateway`, fetches workflow status, retrieves audit data, and supports approved workflow actions such as approve and cancel.

## Explicitly disallowed by design

The SDK does not provide:

- direct blockchain transaction execution methods
- owner-wallet or private-key custody utilities
- direct pay execution endpoints
- direct markets execution endpoints
- direct accounts execution endpoints

## Governance-safe guards

The SDK enforces or validates:

- `correlationId` presence
- `idempotencyKey` presence
- mandate and policy linkage
- bounded expiry windows for profile-aware clients
- action allowlists
- per-transaction spend limits
- risk linkage requirements or warnings by profile/action
- sensitive field redaction in logs

## Provenance and audit

Correlation and intent identifiers remain first-class so developers can inspect gateway decisions, escalation traces, and run summaries without bypassing the trust boundary.
