import type { FinancialIntentAction } from '../core/types.js';
import type { GatewayTransport } from '../core/http.js';

export interface MandateRecord {
  mandateId: string;
  status: string;
  expiresAt?: string;
  capabilities?: FinancialIntentAction[];
  softLimits?: Record<string, string>;
}

export class MandatesApi {
  constructor(private readonly transport: GatewayTransport) {}

  getMandate(mandateId: string): Promise<MandateRecord> {
    return this.transport.get(`/v1/mandates/${mandateId}`, { correlationId: mandateId });
  }

  getCapabilities(mandateId: string): Promise<{ mandateId: string; capabilities: FinancialIntentAction[] }> {
    return this.transport.get(`/v1/mandates/${mandateId}/capabilities`, { correlationId: mandateId });
  }
}
