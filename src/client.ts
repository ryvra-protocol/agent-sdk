import { AgentsApi, type AgentStatus } from './agents/index.js';
import { AuditApi, type AuditEvent, type AuditEventFilters } from './audit/index.js';
import { ensureKnownCapability, ensureMandateActive, ensureWithinSoftLimit } from './core/guards.js';
import { GatewayTransport } from './core/http.js';
import { gatewayRoutes } from './core/routes.js';
import type { GatewayClientConfig, FinancialIntent, SubmitIntentOptions } from './core/types.js';
import { MandatesApi } from './mandates/index.js';
import { PolicyRiskApi } from './policy-risk/index.js';
import { validateFinancialIntent } from './intent/validators.js';

export interface ApprovalPayload {
  approverId: string;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
}

export interface SubmitIntentResponse<TIntent extends FinancialIntent<any, any>> {
  accepted: boolean;
  intent: TIntent;
}

export interface IntentStatusResponse<TIntent extends FinancialIntent<any, any>> {
  intent: TIntent;
  status: string;
  reasonCode?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export class AgentGatewayClient {
  readonly agents: AgentsApi;
  readonly mandates: MandatesApi;
  readonly policyRisk: PolicyRiskApi;
  readonly audit: AuditApi;
  readonly #transport: GatewayTransport;
  readonly #clockSkewMs: number;

  constructor(config: GatewayClientConfig) {
    this.#transport = new GatewayTransport(config);
    this.#clockSkewMs = config.clockSkewMs ?? 30_000;
    this.agents = new AgentsApi(this.#transport);
    this.mandates = new MandatesApi(this.#transport);
    this.policyRisk = new PolicyRiskApi(this.#transport);
    this.audit = new AuditApi(this.#transport);
  }

  async submitIntent<TIntent extends FinancialIntent<any, any>>(intent: TIntent, options: SubmitIntentOptions = {}): Promise<SubmitIntentResponse<TIntent>> {
    validateFinancialIntent(intent, this.#clockSkewMs);
    ensureKnownCapability(intent, options.knownCapabilities ?? options.mandate?.capabilities);
    ensureMandateActive(intent, options.mandate, this.#clockSkewMs);
    ensureWithinSoftLimit(intent, options.softLimit ?? options.mandate?.softLimits?.[intent.assetId]);

    return this.#transport.post(gatewayRoutes.intents, { intent }, {
      correlationId: intent.correlationId,
      idempotencyKey: intent.idempotencyKey,
    }, true);
  }

  getIntent<TIntent extends FinancialIntent<any, any>>(intentId: string, correlationId?: string): Promise<IntentStatusResponse<TIntent>> {
    return this.#transport.get(gatewayRoutes.intent(intentId), correlationId ? { correlationId } : {});
  }

  approveIntent(intentId: string, approvalPayload: ApprovalPayload, correlationId?: string): Promise<{ approved: boolean; intentId: string }> {
    return this.#transport.post(gatewayRoutes.approveIntent(intentId), approvalPayload, correlationId ? { correlationId } : {}, false);
  }

  cancelIntent(intentId: string, correlationId?: string): Promise<{ cancelled: boolean; intentId: string }> {
    return this.#transport.post(gatewayRoutes.cancelIntent(intentId), {}, correlationId ? { correlationId } : {}, false);
  }

  getAgentStatus(agentId: string): Promise<AgentStatus> {
    return this.agents.getStatus(agentId);
  }

  suspendAgent(agentId: string): Promise<{ suspended: boolean; agentId: string }> {
    return this.agents.suspend(agentId);
  }

  getAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
    return this.audit.getEvents(filters);
  }
}
