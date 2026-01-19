import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Token } from '../../tokens/schema/token.schema';
import { User } from '../../users/schemas/user.schema';

export type UserAlertDocument = UserAlert & Document;

export enum AlertCondition {
  ABOVE = 'ABOVE', // Price >= targetPrice
  BELOW = 'BELOW', // Price <= targetPrice
}

@Schema({ timestamps: true })
export class UserAlert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId | User;

  @Prop({ type: Types.ObjectId, ref: 'Token', required: true, index: true })
  token: Types.ObjectId | Token;

  @Prop({ required: true })
  targetPrice: number;

  @Prop({ required: true, enum: AlertCondition })
  condition: AlertCondition;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserAlertSchema = SchemaFactory.createForClass(UserAlert);
