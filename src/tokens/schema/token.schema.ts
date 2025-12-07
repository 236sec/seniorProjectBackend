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

  @Prop({
    type: {
      thumb: { type: String, required: false },
      small: { type: String, required: false },
      large: { type: String, required: false },
    },
    required: false,
  })
  image?: {
    thumb?: string;
    small?: string;
    large?: string;
  };
}

export const TokenSchema = SchemaFactory.createForClass(Token);
