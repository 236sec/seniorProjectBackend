import { Transform } from 'class-transformer';
import { Types } from 'mongoose';

/**
 * Transformer to convert string to MongoDB ObjectId
 * Use with @Transform decorator in DTOs
 */
export function ToObjectId() {
  return Transform(
    ({ value }: { value: string | Types.ObjectId | undefined }) => {
      if (!value) return undefined;
      if (value instanceof Types.ObjectId) return value;
      if (typeof value === 'string') {
        return new Types.ObjectId(value);
      }
      return value;
    },
  );
}
