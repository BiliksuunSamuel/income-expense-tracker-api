import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { BillingFrequency } from 'src/enums';

export class SubscriptionRequestDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  billingPlanId: string;

  @ApiProperty()
  @IsEnum(BillingFrequency)
  billingFrequency: BillingFrequency;
}
