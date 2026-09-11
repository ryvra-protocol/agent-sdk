# Quickstart

## 1. Configure gateway authentication

Create an `AgentGatewayClient` with:

- `baseUrl` pointing to `agent-gateway`
- `auth` token provider for gateway scopes
- `signing` credentials for request signing

## 2. Build a typed intent

Use one of the typed builders:

- `buildPayIntent`
- `buildTransferIntent`
- `buildSwapIntent`
- `buildTradeIntent`
- `buildRebalanceIntent`
- `buildCollectIntent`
- `buildOpenPositionIntent`
- `buildClosePositionIntent`

Every builder input requires:

- `intentId`
- `actorId`
- `assetId`
- `purpose`
- `policyVersion`
- `correlationId`
- `idempotencyKey` (auto-generated if omitted)
- `expiresAt`
- `mandateId`

The SDK derives `actorType=AGENT` and the action enum from the specific builder you call.

## 3. Submit through agent-gateway

Call `client.submitIntent(intent)`.

Optional client-side checks can validate:

- known capabilities
- mandate expiry
- client-known soft limits

These checks improve UX only. Server authority remains final.

## 4. Track execution workflow state

Use:

- `client.getIntent(intentId)`
- `client.getAuditEvents({ correlationId })`
- `client.getAgentStatus(agentId)`

## 5. Handle typed errors

Check `reasonCode`, `intentId`, and `correlationId` on thrown SDK errors to decide whether to retry, escalate, or present a denial reason.
