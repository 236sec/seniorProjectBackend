import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryTokensDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryTokenHistoricalPricesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}
