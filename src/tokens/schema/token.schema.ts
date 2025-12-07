import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TokenDocument = Token & Document;

@Schema({ timestamps: true })
export class Token {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  symbol: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
