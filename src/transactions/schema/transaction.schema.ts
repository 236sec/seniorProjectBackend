import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as Sc, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  MANUAL = 'MANUAL',
  SYNCED = 'SYNCED',
}

export enum TransactionEventType {
  SWAP = 'SWAP',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}
@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Sc.Types.ObjectId, ref: 'Wallet', index: true })
  walletId: Types.ObjectId;

  @Prop({ type: Sc.Types.ObjectId, ref: 'BlockchainWallet' })
  blockchainWalletId: Types.ObjectId;

  @Prop({ type: Sc.Types.ObjectId, ref: 'BankWallet' })
  bankWalletId: Types.ObjectId;

  @Prop({ type: String, enum: TransactionType })
  type: TransactionType;

  @Prop({ type: String })
  from: string;

  @Prop({ type: String })
  to: string;

  @Prop({ type: String, enum: TransactionEventType })
  event_type: TransactionEventType;

  @Prop({ type: Sc.Types.ObjectId, ref: 'TokenContract' })
  tokenContractId: Types.ObjectId;

  @Prop({ type: Sc.Types.ObjectId, ref: 'Token' })
  tokenId: Types.ObjectId;

  // Quantity in string to avoid floating point issues
  @Prop({ type: String })
  quantity: string;

  @Prop({ type: Number })
  price_usd: number;

  @Prop({ type: Number })
  cashflow_usd: number;

  @Prop({ type: Date })
  timestamp: Date;

  // Mongoose timestamps (auto-generated when timestamps: true)
  createdAt: Date;
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
