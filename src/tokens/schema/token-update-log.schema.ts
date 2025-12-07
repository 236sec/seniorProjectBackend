import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TokenUpdateLogDocument = TokenUpdateLog & Document;

@Schema({ timestamps: true })
export class TokenUpdateLog {
  @Prop({ required: true, default: 'coingecko_sync' })
  syncType: string;

  @Prop({ required: true })
  lastUpdatedAt: Date;

  @Prop()
  totalCoins?: number;

  @Prop()
  inserted?: number;

  @Prop()
  updated?: number;
}

export const TokenUpdateLogSchema =
  SchemaFactory.createForClass(TokenUpdateLog);
