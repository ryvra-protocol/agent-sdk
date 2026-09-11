import type { GatewayTransport } from '../core/http.js';
import { gatewayRoutes } from '../core/routes.js';

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
    return this.transport.post(gatewayRoutes.registerAgent, registration, { correlationId: registration.agentId }, false);
  }

  getStatus(agentId: string): Promise<AgentStatus> {
    return this.transport.get(gatewayRoutes.agentStatus(agentId), { correlationId: agentId });
  }

  listSessions(agentId: string): Promise<AgentSession[]> {
    return this.transport.get(gatewayRoutes.agentSessions(agentId), { correlationId: agentId });
  }

  getSession(agentId: string, sessionId: string): Promise<AgentSession> {
    return this.transport.get(gatewayRoutes.agentSession(agentId, sessionId), { correlationId: agentId });
  }

  suspend(agentId: string): Promise<{ suspended: boolean; agentId: string }> {
    return this.transport.post(gatewayRoutes.suspendAgent(agentId), {}, { correlationId: agentId }, false);
  }
}
