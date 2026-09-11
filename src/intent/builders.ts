import { buildIntent } from './validators.js';
import type {
  ClosePositionIntent,
  ClosePositionIntentInput,
  CollectIntent,
  CollectIntentInput,
  OpenPositionIntent,
  OpenPositionIntentInput,
  PaymentIntent,
  PaymentIntentInput,
  RebalanceIntent,
  RebalanceIntentInput,
  SwapIntent,
  SwapIntentInput,
  TradeIntent,
  TradeIntentInput,
  TransferIntent,
  TransferIntentInput,
} from './types.js';

export function buildPayIntent(input: PaymentIntentInput): PaymentIntent {
  const { amount, recipientId, paymentMethodId, ...base } = input;
  return buildIntent('PAY', base, { amount, recipientId, paymentMethodId }, {
    amount,
    chainId: base.chainId,
    recipient: base.recipient ?? recipientId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildTransferIntent(input: TransferIntentInput): TransferIntent {
  const { amount, destinationAccountId, sourceAccountId, ...base } = input;
  return buildIntent('TRANSFER', base, { amount, destinationAccountId, sourceAccountId }, {
    amount,
    chainId: base.chainId,
    recipient: base.recipient ?? destinationAccountId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildSwapIntent(input: SwapIntentInput): SwapIntent {
  const { amount, destinationAssetId, maxSlippageBps, ...base } = input;
  return buildIntent('SWAP', base, { amount, destinationAssetId, maxSlippageBps }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildTradeIntent(input: TradeIntentInput): TradeIntent {
  const { amount, instrumentId, side, orderType, limitPrice, ...base } = input;
  return buildIntent('TRADE', base, { amount, instrumentId, side, orderType, limitPrice }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildRebalanceIntent(input: RebalanceIntentInput): RebalanceIntent {
  const { amount, targetAllocation, ...base } = input;
  return buildIntent('REBALANCE', base, { amount, targetAllocation }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildCollectIntent(input: CollectIntentInput): CollectIntent {
  const { amount, sourceAccountId, ...base } = input;
  return buildIntent('COLLECT', base, { amount, sourceAccountId }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildOpenPositionIntent(input: OpenPositionIntentInput): OpenPositionIntent {
  const { amount, instrumentId, side, leverage, ...base } = input;
  return buildIntent('OPEN_POSITION', base, { amount, instrumentId, side, leverage }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}

export function buildClosePositionIntent(input: ClosePositionIntentInput): ClosePositionIntent {
  const { amount, positionId, ...base } = input;
  return buildIntent('CLOSE_POSITION', base, { amount, positionId }, {
    amount,
    chainId: base.chainId,
    venue: base.venue,
    profileType: base.profileType,
  });
}
