import type { AgentGatewayClient } from '../client.js';
import type { AutonomousProfileConfig } from '../core/types.js';
import { buildPayIntent } from '../intent/builders.js';
import type { PaymentIntent, PaymentIntentInput } from '../intent/types.js';
import { AutonomousProfileClient, type ProfileTemplateInput } from '../profiles/index.js';

export type ProcurementProfileConfig = Omit<AutonomousProfileConfig, 'profileType'> & { profileType?: 'PROCUREMENT' };
export type ProcurementVendorPaymentIntentInput = ProfileTemplateInput<PaymentIntentInput>;

export function buildProcurementVendorPaymentIntent(input: PaymentIntentInput): PaymentIntent {
  return buildPayIntent({ ...input, profileType: 'PROCUREMENT' });
}

export class ProcurementProfileClient extends AutonomousProfileClient<'PROCUREMENT'> {
  constructor(client: AgentGatewayClient, config: ProcurementProfileConfig) {
    super(client, { ...config, profileType: 'PROCUREMENT' });
  }

  buildVendorPaymentIntent(input: ProcurementVendorPaymentIntentInput): PaymentIntent {
    return buildProcurementVendorPaymentIntent(this.applyDefaults(input, 'procurement-vendor-payment'));
  }

  submitVendorPaymentIntent(input: ProcurementVendorPaymentIntentInput) {
    return this.submitIntent(this.buildVendorPaymentIntent(input));
  }
}
