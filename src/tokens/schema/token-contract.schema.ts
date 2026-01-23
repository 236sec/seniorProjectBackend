import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TokenContractDocument = TokenContract & Document;

@Schema({ timestamps: true })
export class TokenContract {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Token' })
  tokenId: Types.ObjectId;

  @Prop({ required: true, index: true })
  coinGeckoId: string;

  @Prop({ required: true, index: true })
  chainId: string; // e.g., 'ethereum', 'polygon-pos', 'binance-smart-chain'

  @Prop({ required: true, lowercase: true, index: true })
  contractAddress: string; // Lowercase hex address

  @Prop({ index: true })
  symbol?: string;

  @Prop()
  name?: string;

  @Prop()
  decimals?: number;
}

// Create compound index for efficient lookups
export const TokenContractSchema = SchemaFactory.createForClass(TokenContract);

TokenContractSchema.index({ chainId: 1, contractAddress: 1 }, { unique: true });
TokenContractSchema.index({ coinGeckoId: 1, chainId: 1 });
