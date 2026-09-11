import type { GatewayTransport } from '../core/http.js';
import { gatewayRoutes } from '../core/routes.js';

export interface DecisionRecord {
  decisionId: string;
  status: 'APPROVED' | 'DENIED' | 'PENDING';
  reasonCode?: string;
  correlationId?: string;
}

export class PolicyRiskApi {
  constructor(private readonly transport: GatewayTransport) {}

  getPolicyDecision(decisionId: string): Promise<DecisionRecord> {
    return this.transport.get(gatewayRoutes.policyDecision(decisionId), { correlationId: decisionId });
  }

  getRiskDecision(decisionId: string): Promise<DecisionRecord> {
    return this.transport.get(gatewayRoutes.riskDecision(decisionId), { correlationId: decisionId });
  }
}
