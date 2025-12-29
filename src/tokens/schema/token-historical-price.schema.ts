import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TokenHistoricalPriceDocument = TokenHistoricalPrice & Document;

@Schema({ _id: false })
export class DailyPrice {
  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number })
  volume_24h: number;

  @Prop({ type: Number })
  market_cap: number;
}

export const DailyPriceSchema = SchemaFactory.createForClass(DailyPrice);

@Schema({ timestamps: true })
export class TokenHistoricalPrice {
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: 'Token',
    unique: true,
    index: true,
  })
  tokenId: MongooseSchema.Types.ObjectId;

  @Prop({ type: [DailyPriceSchema], default: [] })
  dailyPrices: DailyPrice[];

  @Prop({ type: Date })
  oldestDataPoint: Date;

  @Prop({ type: Date })
  newestDataPoint: Date;
}

// Create compound index for efficient lookups
export const TokenHistoricalPriceSchema =
  SchemaFactory.createForClass(TokenHistoricalPrice);

TokenHistoricalPriceSchema.index({ tokenId: 1, 'dailyPrices.date': 1 });
