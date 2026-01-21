import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { AlertCondition } from '../schema/notification.schema';

export class UpdateNotificationDto {
  @IsOptional()
  @IsNumber()
  targetPrice: number;

  @IsOptional()
  @IsEnum(AlertCondition)
  condition: AlertCondition;

  @IsOptional()
  @IsBoolean()
  isActive: boolean;
}
