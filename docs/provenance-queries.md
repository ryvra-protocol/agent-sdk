# Provenance queries

Use audit helpers to understand what happened to an autonomous profile run without exposing direct execution controls.

## By intent

- `client.audit.getIntentTimeline(intentId)`
- `profileClient.getAuditTimelineByIntentId(intentId)`
- `profileClient.getDecisionTraceByIntentId(intentId)`

## By correlation

- `client.audit.getCorrelationTimeline(correlationId)`
- `profileClient.getAuditTimelineByCorrelationId(correlationId)`
- `profileClient.getDecisionTraceByCorrelationId(correlationId)`
- `profileClient.summarizeOutcomesByCorrelationId(correlationId)`

## Normalization helpers

- `normalizeAuditEvents(events)` for ordered timeline entries
- `normalizeGatewayDecisionEvents(events)` for status-oriented developer traces
- `summarizeRunOutcomes(events)` for aggregate outcome summaries by status, profile, and agent
