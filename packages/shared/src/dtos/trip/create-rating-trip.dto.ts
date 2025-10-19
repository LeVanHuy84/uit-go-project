// create-trip-rating.dto.ts
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTripRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}
