import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BankWalletDocument = BankWallet & Document;

@Schema({ _id: false })
export class TokenBalance {
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

export const TokenBalanceSchema = SchemaFactory.createForClass(TokenBalance);

@Schema({ timestamps: true })
export class BankWallet {
  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true, index: true })
  walletId: Types.ObjectId;

  @Prop({ required: true })
  apiKey: string;

  @Prop({ required: true })
  apiSecret: string; // This should be encrypted!

  @Prop({ type: [TokenBalanceSchema], default: [] })
  tokens: TokenBalance[];
}

export const BankWalletSchema = SchemaFactory.createForClass(BankWallet);
