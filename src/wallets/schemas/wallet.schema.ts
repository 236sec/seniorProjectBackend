import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PortfolioPerformance,
  PortfolioPerformanceSchema,
} from './portfolio-performance.schema';

export type WalletDocument = Wallet & Document;

@Schema({ _id: false })
export class ManualTokenBalance {
  @Prop({
    type: Types.ObjectId,
    ref: 'Token',
    required: true,
    index: true,
  })
  tokenId: Types.ObjectId;

  // Store raw on-chain balance as string to preserve precision
  @Prop({ type: String, required: true })
  balance: string;
}

export const ManualTokenBalanceSchema =
  SchemaFactory.createForClass(ManualTokenBalance);

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String })
  description: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'BlockchainWallet' }],
    required: true,
    index: true,
  })
  blockchainWalletId: Types.ObjectId[];

  @Prop({ type: [ManualTokenBalanceSchema], default: [] })
  manualTokens: ManualTokenBalance[];

  @Prop({ type: [PortfolioPerformanceSchema], default: [] })
  portfolioPerformance: PortfolioPerformance[];
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
