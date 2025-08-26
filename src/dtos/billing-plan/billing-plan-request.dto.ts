import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Min, MinLength } from 'class-validator';
import { BillingPlanType } from 'src/enums';

export class BillingPlanRequestDto {
  @ApiProperty()
  @IsEnum(BillingPlanType)
  @IsNotEmpty()
  @ApiProperty({ default: BillingPlanType.Regular })
  title: BillingPlanType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ default: 0 })
  @IsNotEmpty()
  @Min(0)
  price: number;

  @ApiProperty({ default: 0 })
  @Min(0)
  @IsNotEmpty()
  yearlyDiscount: number;

  @ApiProperty({ type: [String] })
  @IsNotEmpty()
  @MinLength(1, { each: true })
  features: string[];

  @ApiProperty({ type: [String] })
  unavailableFeatures: string[];

  @ApiProperty({ default: 0 })
  @Min(-1)
  @IsNotEmpty()
  maxNumberOfTransactions: number;
}
