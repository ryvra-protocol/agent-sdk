import type { GatewayTransport } from '../core/http.js';

export interface AgentRegistration {
  agentId: string;
  name: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentSession {
  sessionId: string;
  status: string;
  startedAt?: string;
  lastSeenAt?: string;
}

export interface AgentStatus {
  agentId: string;
  status: string;
  lastHeartbeatAt?: string;
}

export class AgentsApi {
  constructor(private readonly transport: GatewayTransport) {}

  registerAgent(registration: AgentRegistration): Promise<{ registered: boolean; agentId: string }> {
    return this.transport.post('/v1/agents/register', registration, { correlationId: registration.agentId }, false);
  }

  getStatus(agentId: string): Promise<AgentStatus> {
    return this.transport.get(`/v1/agents/${agentId}/status`, { correlationId: agentId });
  }

  listSessions(agentId: string): Promise<AgentSession[]> {
    return this.transport.get(`/v1/agents/${agentId}/sessions`, { correlationId: agentId });
  }

  getSession(agentId: string, sessionId: string): Promise<AgentSession> {
    return this.transport.get(`/v1/agents/${agentId}/sessions/${sessionId}`, { correlationId: agentId });
  }

  suspend(agentId: string): Promise<{ suspended: boolean; agentId: string }> {
    return this.transport.post(`/v1/agents/${agentId}/suspend`, {}, { correlationId: agentId }, false);
  }
}
