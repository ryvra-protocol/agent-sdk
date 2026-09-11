import type { AgentGatewayClient } from '../client.js';
import type { AutonomousProfileConfig } from '../core/types.js';
import { buildTransferIntent } from '../intent/builders.js';
import type { TransferIntent, TransferIntentInput } from '../intent/types.js';
import { AutonomousProfileClient, type ProfileTemplateInput } from '../profiles/index.js';

export type SettlementProfileConfig = Omit<AutonomousProfileConfig, 'profileType'> & { profileType?: 'SETTLEMENT' };
export type SettlementReconciliationTransferIntentInput = ProfileTemplateInput<TransferIntentInput>;

export function buildSettlementReconciliationTransferIntent(input: TransferIntentInput): TransferIntent {
  return buildTransferIntent({ ...input, profileType: 'SETTLEMENT' });
}

export class SettlementProfileClient extends AutonomousProfileClient<'SETTLEMENT'> {
  constructor(client: AgentGatewayClient, config: SettlementProfileConfig) {
    super(client, { ...config, profileType: 'SETTLEMENT' });
  }

  buildReconciliationTransferIntent(input: SettlementReconciliationTransferIntentInput): TransferIntent {
    return buildSettlementReconciliationTransferIntent(this.applyDefaults(input, 'settlement-reconciliation-transfer'));
  }

  submitReconciliationTransferIntent(input: SettlementReconciliationTransferIntentInput) {
    return this.submitIntent(this.buildReconciliationTransferIntent(input));
  }
}
