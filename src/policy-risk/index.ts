import type { GatewayTransport } from '../core/http.js';

export interface DecisionRecord {
  decisionId: string;
  status: 'APPROVED' | 'DENIED' | 'PENDING';
  reasonCode?: string;
  correlationId?: string;
}

export class PolicyRiskApi {
  constructor(private readonly transport: GatewayTransport) {}

  getPolicyDecision(decisionId: string): Promise<DecisionRecord> {
    return this.transport.get(`/v1/policy-decisions/${decisionId}`, { correlationId: decisionId });
  }

  getRiskDecision(decisionId: string): Promise<DecisionRecord> {
    return this.transport.get(`/v1/risk-decisions/${decisionId}`, { correlationId: decisionId });
  }
}
