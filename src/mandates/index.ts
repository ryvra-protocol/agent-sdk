import type { FinancialIntentAction } from '../core/types.js';
import type { GatewayTransport } from '../core/http.js';
import { gatewayRoutes } from '../core/routes.js';

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
    return this.transport.get(gatewayRoutes.mandate(mandateId), { correlationId: mandateId });
  }

  getCapabilities(mandateId: string): Promise<{ mandateId: string; capabilities: FinancialIntentAction[] }> {
    return this.transport.get(gatewayRoutes.mandateCapabilities(mandateId), { correlationId: mandateId });
  }
}
