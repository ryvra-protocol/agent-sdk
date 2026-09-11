import type { AgentGatewayClient } from '../client.js';
import type { AutonomousProfileConfig } from '../core/types.js';
import { buildClosePositionIntent, buildOpenPositionIntent } from '../intent/builders.js';
import type {
  ClosePositionIntent,
  ClosePositionIntentInput,
  OpenPositionIntent,
  OpenPositionIntentInput,
} from '../intent/types.js';
import { AutonomousProfileClient, type ProfileTemplateInput } from '../profiles/index.js';

export type MarketProfileConfig = Omit<AutonomousProfileConfig, 'profileType'> & { profileType?: 'MARKET' };
export type MarketOpenPositionIntentInput = ProfileTemplateInput<OpenPositionIntentInput>;
export type MarketClosePositionIntentInput = ProfileTemplateInput<ClosePositionIntentInput>;

export function buildMarketOpenPositionIntent(input: OpenPositionIntentInput): OpenPositionIntent {
  return buildOpenPositionIntent({ ...input, profileType: 'MARKET' });
}

export function buildMarketClosePositionIntent(input: ClosePositionIntentInput): ClosePositionIntent {
  return buildClosePositionIntent({ ...input, profileType: 'MARKET' });
}

export class MarketProfileClient extends AutonomousProfileClient<'MARKET'> {
  constructor(client: AgentGatewayClient, config: MarketProfileConfig) {
    super(client, { ...config, profileType: 'MARKET' });
  }

  buildOpenPositionIntent(input: MarketOpenPositionIntentInput): OpenPositionIntent {
    return buildMarketOpenPositionIntent(this.applyDefaults(input, 'market-open-position'));
  }

  buildClosePositionIntent(input: MarketClosePositionIntentInput): ClosePositionIntent {
    return buildMarketClosePositionIntent(this.applyDefaults(input, 'market-close-position'));
  }

  submitOpenPositionIntent(input: MarketOpenPositionIntentInput) {
    return this.submitIntent(this.buildOpenPositionIntent(input));
  }

  submitClosePositionIntent(input: MarketClosePositionIntentInput) {
    return this.submitIntent(this.buildClosePositionIntent(input));
  }
}
