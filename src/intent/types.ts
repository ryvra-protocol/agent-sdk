import type { BaseIntentInput, FinancialIntent, IntentAmount } from '../core/types.js';

export interface PaymentIntentDetails {
  amount: IntentAmount;
  recipientId: string;
  paymentMethodId?: string;
}

export interface TransferIntentDetails {
  amount: IntentAmount;
  destinationAccountId: string;
  sourceAccountId?: string;
}

export interface SwapIntentDetails {
  amount: IntentAmount;
  destinationAssetId: string;
  maxSlippageBps?: number;
}

export interface TradeIntentDetails {
  amount: IntentAmount;
  instrumentId: string;
  side: 'BUY' | 'SELL';
  orderType?: 'MARKET' | 'LIMIT';
  limitPrice?: string;
}

export interface RebalanceIntentDetails {
  amount?: IntentAmount;
  targetAllocation: Record<string, number>;
}

export interface CollectIntentDetails {
  amount: IntentAmount;
  sourceAccountId: string;
}

export interface OpenPositionIntentDetails {
  amount: IntentAmount;
  instrumentId: string;
  side: 'LONG' | 'SHORT';
  leverage?: number;
}

export interface ClosePositionIntentDetails {
  amount?: IntentAmount;
  positionId: string;
}

export type PaymentIntent = FinancialIntent<'PAY', PaymentIntentDetails>;
export type TransferIntent = FinancialIntent<'TRANSFER', TransferIntentDetails>;
export type SwapIntent = FinancialIntent<'SWAP', SwapIntentDetails>;
export type TradeIntent = FinancialIntent<'TRADE', TradeIntentDetails>;
export type RebalanceIntent = FinancialIntent<'REBALANCE', RebalanceIntentDetails>;
export type CollectIntent = FinancialIntent<'COLLECT', CollectIntentDetails>;
export type OpenPositionIntent = FinancialIntent<'OPEN_POSITION', OpenPositionIntentDetails>;
export type ClosePositionIntent = FinancialIntent<'CLOSE_POSITION', ClosePositionIntentDetails>;

export interface PaymentIntentInput extends BaseIntentInput, PaymentIntentDetails {}
export interface TransferIntentInput extends BaseIntentInput, TransferIntentDetails {}
export interface SwapIntentInput extends BaseIntentInput, SwapIntentDetails {}
export interface TradeIntentInput extends BaseIntentInput, TradeIntentDetails {}
export interface RebalanceIntentInput extends BaseIntentInput, RebalanceIntentDetails {}
export interface CollectIntentInput extends BaseIntentInput, CollectIntentDetails {}
export interface OpenPositionIntentInput extends BaseIntentInput, OpenPositionIntentDetails {}
export interface ClosePositionIntentInput extends BaseIntentInput, ClosePositionIntentDetails {}
