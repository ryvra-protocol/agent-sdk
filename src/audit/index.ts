import type { GatewayTransport } from '../core/http.js';

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

export function traceFromIntent(intentId: string): { intentId: string; traceparent: string } {
  return {
    intentId,
    traceparent: `00-${intentId.replace(/-/g, '').padEnd(32, '0').slice(0, 32)}-0000000000000001-01`,
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
    return this.transport.get(`/v1/audit-events${suffix}`, { correlationId: filters.correlationId ?? filters.intentId });
  }

  async getCorrelationTimeline(correlationId: string): Promise<TimelineEvent[]> {
    return normalizeAuditEvents(await this.getEvents({ correlationId }));
  }
}
