import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  // @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  // userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true, index: true })
  provider: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ type: [Types.ObjectId], ref: 'Wallet' })
  wallets: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
