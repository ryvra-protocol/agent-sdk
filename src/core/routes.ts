export const GATEWAY_ROUTE_PREFIXES = [
  '/v1/intents',
  '/v1/agents',
  '/v1/mandates',
  '/v1/policy-decisions',
  '/v1/risk-decisions',
  '/v1/audit-events',
] as const;

export const gatewayRoutes = {
  intents: '/v1/intents',
  intent: (intentId: string) => `/v1/intents/${intentId}`,
  approveIntent: (intentId: string) => `/v1/intents/${intentId}/approve`,
  cancelIntent: (intentId: string) => `/v1/intents/${intentId}/cancel`,
  registerAgent: '/v1/agents/register',
  agentStatus: (agentId: string) => `/v1/agents/${agentId}/status`,
  agentSessions: (agentId: string) => `/v1/agents/${agentId}/sessions`,
  agentSession: (agentId: string, sessionId: string) => `/v1/agents/${agentId}/sessions/${sessionId}`,
  suspendAgent: (agentId: string) => `/v1/agents/${agentId}/suspend`,
  mandate: (mandateId: string) => `/v1/mandates/${mandateId}`,
  mandateCapabilities: (mandateId: string) => `/v1/mandates/${mandateId}/capabilities`,
  policyDecision: (decisionId: string) => `/v1/policy-decisions/${decisionId}`,
  riskDecision: (decisionId: string) => `/v1/risk-decisions/${decisionId}`,
  auditEvents: '/v1/audit-events',
};
