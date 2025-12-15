import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BlockchainWalletDocument = BlockchainWallet & Document;

@Schema({ _id: false })
export class TokenBalance {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'TokenContract',
    required: true,
    index: true,
  })
  tokenContractId: MongooseSchema.Types.ObjectId;

  // Store raw on-chain balance as string to preserve precision
  @Prop({ type: String, required: true })
  balance: string;
}

export const TokenBalanceSchema = SchemaFactory.createForClass(TokenBalance);

@Schema({ timestamps: true })
export class BlockchainWallet {
  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  chains: string[];

  @Prop({ type: [TokenBalanceSchema], default: [] })
  tokens: TokenBalance[];
}

export const BlockchainWalletSchema =
  SchemaFactory.createForClass(BlockchainWallet);
