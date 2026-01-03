import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PortfolioPerformanceDocument = PortfolioPerformance & Document;

@Schema({ _id: false })
export class PortfolioPerformance {
  @Prop({ type: Types.ObjectId, ref: 'Token', required: true })
  tokenId: Types.ObjectId;

  @Prop({ type: Number, required: true, name: 'total_invested_amount' })
  totalInvestedAmount: number;

  @Prop({ type: String, required: true, name: 'total_balance' })
  totalBalance: string; // Store raw on-chain balance as string to preserve precision ex."0x542253a126ce40000"

  @Prop({ type: Number, required: true, alias: 'total_cashflow_usd' })
  totalCashflowUsd: number;

  @Prop({ type: Number, required: true, default: 0 })
  costBasis: number;

  @Prop({ type: Number, required: true, default: 0 })
  averageUnitCost: number;
}

export const PortfolioPerformanceSchema =
  SchemaFactory.createForClass(PortfolioPerformance);
