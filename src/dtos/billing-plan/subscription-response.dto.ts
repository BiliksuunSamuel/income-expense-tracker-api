import { ApiProperty } from '@nestjs/swagger';
import { BillingFrequency, SubscriptionStatus } from 'src/enums';
import { BaseSchema } from 'src/schemas';
import { BillingPlan } from 'src/schemas/billing.plan.schema';

export class SubscriptionResponse extends BaseSchema {
  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  planTitle: string;

  @ApiProperty()
  plan: BillingPlan;

  @ApiProperty()
  maxNumberOfTransactions: number;

  @ApiProperty()
  status: SubscriptionStatus;

  @ApiProperty()
  billingFrequency: BillingFrequency;

  /// Entries recorded this calendar month, which the plan's limit counts.
  @ApiProperty({ required: false })
  entriesThisMonth?: number;

  /// The renewal invoice waiting to be paid, if there is one.
  @ApiProperty({ required: false, nullable: true })
  renewalInvoiceId?: string | null;

  /// When a paid plan stops if its renewal stays unpaid; null when free.
  @ApiProperty({ required: false, nullable: true })
  graceEndsAt?: Date | null;
}
