import type { AutonomousProfileConfig } from '../core/types.js';
import { buildPayIntent, buildRebalanceIntent } from '../intent/builders.js';
import type { PaymentIntent, PaymentIntentInput, RebalanceIntent, RebalanceIntentInput } from '../intent/types.js';
import { AutonomousProfileClient, type ProfileTemplateInput } from '../profiles/index.js';
import type { AgentGatewayClient } from '../client.js';

export type TreasuryProfileConfig = Omit<AutonomousProfileConfig, 'profileType'> & { profileType?: 'TREASURY' };
export type TreasuryPayoutIntentInput = ProfileTemplateInput<PaymentIntentInput>;
export type TreasuryRebalanceIntentInput = ProfileTemplateInput<RebalanceIntentInput>;

export function buildTreasuryPayoutIntent(input: PaymentIntentInput): PaymentIntent {
  return buildPayIntent({ ...input, profileType: 'TREASURY' });
}

export function buildTreasuryRebalanceIntent(input: RebalanceIntentInput): RebalanceIntent {
  return buildRebalanceIntent({ ...input, profileType: 'TREASURY' });
}

export class TreasuryProfileClient extends AutonomousProfileClient<'TREASURY'> {
  constructor(client: AgentGatewayClient, config: TreasuryProfileConfig) {
    super(client, { ...config, profileType: 'TREASURY' });
  }

  buildPayoutIntent(input: TreasuryPayoutIntentInput): PaymentIntent {
    return buildTreasuryPayoutIntent(this.applyDefaults(input, 'treasury-payout'));
  }

  buildRebalanceIntent(input: TreasuryRebalanceIntentInput): RebalanceIntent {
    return buildTreasuryRebalanceIntent(this.applyDefaults(input, 'treasury-rebalance'));
  }

  submitPayoutIntent(input: TreasuryPayoutIntentInput) {
    return this.submitIntent(this.buildPayoutIntent(input));
  }

  submitRebalanceIntent(input: TreasuryRebalanceIntentInput) {
    return this.submitIntent(this.buildRebalanceIntent(input));
  }
}

export { buildRebalanceIntent } from '../intent/builders.js';
export type { RebalanceIntent, RebalanceIntentInput } from '../intent/types.js';
