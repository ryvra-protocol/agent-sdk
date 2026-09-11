# Security model

## Gateway-only authority

This SDK is intentionally unable to bypass `agent-gateway` for agent-originated execution.

It does not provide:

- direct blockchain RPC execution helpers
- owner-wallet or private-key custody utilities
- direct accounts/pay/markets execution clients

Execution-facing public APIs are limited to gateway workflow methods.

## Safe defaults

- Request signing is enabled by default through required signing config.
- Idempotency keys are generated when omitted by the caller.
- Timeouts default to strict short-lived values.
- Retries are restricted to retryable gateway availability conditions.
- Authorization denials are not retried.
- Sensitive log fields are redacted before logger emission.
- Expiry checks allow bounded clock-skew tolerance.

## Local guardrails

The SDK can pre-check:

- action capability membership
- mandate expiry
- client-known soft limits

These are non-authoritative guardrails. `agent-gateway`, policy, and risk systems remain the source of truth.

## Provenance

The SDK preserves `correlationId` and exposes timeline normalization helpers so developers can audit agent behavior without embedding direct execution logic in the SDK.
