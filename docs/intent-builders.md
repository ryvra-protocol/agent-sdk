# Intent builders

## Supported actions

| Action | Builder |
| --- | --- |
| `PAY` | `buildPayIntent` |
| `TRANSFER` | `buildTransferIntent` |
| `SWAP` | `buildSwapIntent` |
| `TRADE` | `buildTradeIntent` |
| `REBALANCE` | `buildRebalanceIntent` |
| `COLLECT` | `buildCollectIntent` |
| `OPEN_POSITION` | `buildOpenPositionIntent` |
| `CLOSE_POSITION` | `buildClosePositionIntent` |

## Required base fields

All builders enforce the following agent-flow fields:

- `intentId`
- `actorId`
- `assetId`
- `purpose`
- `policyVersion`
- `correlationId`
- `expiresAt`
- `mandateId`

`actorType` is fixed to `AGENT`.

`idempotencyKey` is optional in builder input and auto-generated when omitted.

## Action-specific fields

- `PAY`: `amount`, `recipientId`
- `TRANSFER`: `amount`, `destinationAccountId`
- `SWAP`: `amount`, `destinationAssetId`
- `TRADE`: `amount`, `instrumentId`, `side`
- `REBALANCE`: `targetAllocation`
- `COLLECT`: `amount`, `sourceAccountId`
- `OPEN_POSITION`: `amount`, `instrumentId`, `side`
- `CLOSE_POSITION`: `positionId`

## Validation behavior

Builders validate required fields at construction time and normalize `expiresAt` to ISO-8601.

Use `validateFinancialIntent(intent)` before custom handling if you need standalone validation outside client submission.
