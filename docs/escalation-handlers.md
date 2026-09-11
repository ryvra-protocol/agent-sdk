# Escalation handlers

Use `normalizeGatewayDecision` to turn gateway status payloads into typed SDK decisions.
Use `handleGatewayDecision` or `profileClient.handleIntentDecision()` to dispatch typed callbacks.

Supported escalation states:

- `REVIEW`
- `CHALLENGE`
- `DELAY`
- `QUARANTINE`
- `DENIED`
- `BLOCKED`

Recommended handling patterns:

- `REVIEW`: route to human approval or operational review
- `CHALLENGE`: open a human-in-loop case with the provided reason code
- `DELAY`: reschedule polling or retry planning without bypassing the gateway
- `QUARANTINE`: isolate the run and require manual intervention
- `DENIED`: stop the run and surface policy or risk reason codes
- `BLOCKED`: treat as a hard stop and alert security or governance owners

Decision objects expose:

- `status`
- `reasonCode`
- `intentId`
- `correlationId`
- `profileType`
- `humanActionRequired`
- `terminal`
