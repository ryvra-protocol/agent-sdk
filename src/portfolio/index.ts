import type { AgentGatewayClient } from '../client.js';
import type { AutonomousProfileConfig } from '../core/types.js';
import { buildRebalanceIntent } from '../intent/builders.js';
import type { RebalanceIntent, RebalanceIntentInput } from '../intent/types.js';
import { AutonomousProfileClient, type ProfileTemplateInput } from '../profiles/index.js';

export type PortfolioProfileConfig = Omit<AutonomousProfileConfig, 'profileType'> & { profileType?: 'PORTFOLIO' };
export type PortfolioRebalanceIntentInput = ProfileTemplateInput<RebalanceIntentInput>;

export function buildPortfolioRebalanceIntent(input: RebalanceIntentInput): RebalanceIntent {
  return buildRebalanceIntent({ ...input, profileType: 'PORTFOLIO' });
}

export class PortfolioProfileClient extends AutonomousProfileClient<'PORTFOLIO'> {
  constructor(client: AgentGatewayClient, config: PortfolioProfileConfig) {
    super(client, { ...config, profileType: 'PORTFOLIO' });
  }

  buildRebalanceIntent(input: PortfolioRebalanceIntentInput): RebalanceIntent {
    return buildPortfolioRebalanceIntent(this.applyDefaults(input, 'portfolio-rebalance'));
  }

  submitRebalanceIntent(input: PortfolioRebalanceIntentInput) {
    return this.submitIntent(this.buildRebalanceIntent(input));
  }
}
