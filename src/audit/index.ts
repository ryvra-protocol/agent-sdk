import { createHash } from 'node:crypto';
import type { GatewayTransport } from '../core/http.js';
import type { AutonomousProfileType } from '../core/types.js';
import { gatewayRoutes } from '../core/routes.js';

export interface AuditEvent {
  eventId: string;
  correlationId: string;
  intentId?: string;
  type: string;
  timestamp: string;
  reasonCode?: string;
  payload?: Record<string, unknown>;
}

export interface AuditEventFilters {
  correlationId?: string;
  intentId?: string;
  agentId?: string;
  type?: string;
  limit?: number;
}

export interface TimelineEvent {
  at: string;
  label: string;
  reasonCode?: string;
  intentId?: string;
  correlationId: string;
  payload?: Record<string, unknown>;
}

export type DecisionTraceStatus = 'PENDING' | 'APPROVED' | 'REVIEW' | 'CHALLENGE' | 'DELAY' | 'QUARANTINE' | 'DENIED' | 'BLOCKED' | 'CANCELLED' | 'UNKNOWN';

export interface DecisionTrace {
  at: string;
  status: DecisionTraceStatus;
  reasonCode?: string;
  intentId?: string;
  correlationId: string;
  profileType?: AutonomousProfileType;
  agentId?: string;
  payload?: Record<string, unknown>;
}

export interface RunOutcomeSummary {
  totalEvents: number;
  byStatus: Partial<Record<DecisionTraceStatus, number>>;
  byProfile: Partial<Record<AutonomousProfileType, number>>;
  byAgent: Record<string, number>;
}

const DECISION_STATUSES: DecisionTraceStatus[] = [
  'PENDING',
  'APPROVED',
  'REVIEW',
  'CHALLENGE',
  'DELAY',
  'QUARANTINE',
  'DENIED',
  'BLOCKED',
  'CANCELLED',
  'UNKNOWN',
];

function inferDecisionStatus(event: AuditEvent): DecisionTraceStatus {
  const payloadStatus = typeof event.payload?.status === 'string' ? event.payload.status.toUpperCase() : undefined;
  if (payloadStatus && DECISION_STATUSES.includes(payloadStatus as DecisionTraceStatus)) {
    return payloadStatus as DecisionTraceStatus;
  }

  const normalizedType = event.type.toUpperCase();
  for (const status of DECISION_STATUSES) {
    if (normalizedType.includes(status)) {
      return status;
    }
  }

  if (normalizedType.includes('SUBMITTED') || normalizedType.includes('PENDING')) {
    return 'PENDING';
  }

  return 'UNKNOWN';
}

export function traceFromIntent(intentId: string): { intentId: string; traceparent: string } {
  const traceId = createHash('sha256').update(intentId).digest('hex').slice(0, 32);
  return {
    intentId,
    traceparent: `00-${traceId}-0000000000000001-01`,
  };
}

export function normalizeAuditEvents(events: AuditEvent[]): TimelineEvent[] {
  return [...events]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map((event) => ({
      at: event.timestamp,
      label: event.type,
      reasonCode: event.reasonCode,
      intentId: event.intentId,
      correlationId: event.correlationId,
      payload: event.payload,
    }));
}

export function normalizeGatewayDecisionEvents(events: AuditEvent[]): DecisionTrace[] {
  return [...events]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map((event) => ({
      at: event.timestamp,
      status: inferDecisionStatus(event),
      reasonCode: event.reasonCode,
      intentId: event.intentId,
      correlationId: event.correlationId,
      profileType: typeof event.payload?.profileType === 'string' ? event.payload.profileType as AutonomousProfileType : undefined,
      agentId: typeof event.payload?.actorId === 'string' ? event.payload.actorId : undefined,
      payload: event.payload,
    }));
}

export function summarizeRunOutcomes(events: AuditEvent[]): RunOutcomeSummary {
  const traces = normalizeGatewayDecisionEvents(events);
  const byStatus: Partial<Record<DecisionTraceStatus, number>> = {};
  const byProfile: Partial<Record<AutonomousProfileType, number>> = {};
  const byAgent: Record<string, number> = {};

  for (const trace of traces) {
    byStatus[trace.status] = (byStatus[trace.status] ?? 0) + 1;
    if (trace.profileType) {
      byProfile[trace.profileType] = (byProfile[trace.profileType] ?? 0) + 1;
    }
    if (trace.agentId) {
      byAgent[trace.agentId] = (byAgent[trace.agentId] ?? 0) + 1;
    }
  }

  return {
    totalEvents: traces.length,
    byStatus,
    byProfile,
    byAgent,
  };
}

export class AuditApi {
  constructor(private readonly transport: GatewayTransport) {}

  async getEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.transport.get(`${gatewayRoutes.auditEvents}${suffix}`, { correlationId: filters.correlationId ?? filters.intentId });
  }

  async getCorrelationTimeline(correlationId: string): Promise<TimelineEvent[]> {
    return normalizeAuditEvents(await this.getEvents({ correlationId }));
  }

  async getIntentTimeline(intentId: string): Promise<TimelineEvent[]> {
    return normalizeAuditEvents(await this.getEvents({ intentId }));
  }

  async getDecisionTraceByCorrelationId(correlationId: string): Promise<DecisionTrace[]> {
    return normalizeGatewayDecisionEvents(await this.getEvents({ correlationId }));
  }

  async getDecisionTraceByIntentId(intentId: string): Promise<DecisionTrace[]> {
    return normalizeGatewayDecisionEvents(await this.getEvents({ intentId }));
  }
}
