import { AgentsApi, type AgentStatus } from './agents/index.js';
import { AuditApi, type AuditEvent, type AuditEventFilters } from './audit/index.js';
import { ensureKnownCapability, ensureMandateActive, ensureWithinSoftLimit } from './core/guards.js';
import { GatewayTransport } from './core/http.js';
import type { GatewayClientConfig, FinancialIntent, SubmitIntentOptions } from './core/types.js';
import { MandatesApi } from './mandates/index.js';
import { PolicyRiskApi } from './policy-risk/index.js';
import { validateFinancialIntent } from './intent/validators.js';

export interface ApprovalPayload {
  approverId: string;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
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

  async submitIntent<TIntent extends FinancialIntent<any, any>>(intent: TIntent, options: SubmitIntentOptions = {}): Promise<{ accepted: boolean; intent: TIntent }> {
    validateFinancialIntent(intent, this.#clockSkewMs);
    ensureKnownCapability(intent, options.knownCapabilities ?? options.mandate?.capabilities);
    ensureMandateActive(intent, options.mandate, this.#clockSkewMs);
    ensureWithinSoftLimit(intent, options.softLimit ?? options.mandate?.softLimits?.[intent.assetId]);

    return this.#transport.post('/v1/intents', { intent }, {
      correlationId: intent.correlationId,
      idempotencyKey: intent.idempotencyKey,
    }, true);
  }

  getIntent<TIntent extends FinancialIntent<any, any>>(intentId: string, correlationId = intentId): Promise<{ intent: TIntent; status: string }> {
    return this.#transport.get(`/v1/intents/${intentId}`, { correlationId });
  }

  approveIntent(intentId: string, approvalPayload: ApprovalPayload, correlationId = intentId): Promise<{ approved: boolean; intentId: string }> {
    return this.#transport.post(`/v1/intents/${intentId}/approve`, approvalPayload, { correlationId }, false);
  }

  cancelIntent(intentId: string, correlationId = intentId): Promise<{ cancelled: boolean; intentId: string }> {
    return this.#transport.post(`/v1/intents/${intentId}/cancel`, {}, { correlationId }, false);
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
