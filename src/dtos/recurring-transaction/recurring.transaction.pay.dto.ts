import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

/** Records one occurrence of a repeat now (paid early, or confirmed). */
export class RecurringPayment {
  /** Made by the app so a retried request records once. */
  @ApiProperty()
  @Matches(/^[A-Za-z0-9-]{8,64}$/)
  transactionId: string;

  /** The occurrence being paid: the repeat's `nextRunAt` as the app saw it. */
  @ApiProperty()
  @IsDateString()
  dueAt: string;

  /** When it was paid; now if left out. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export enum RecurringPaymentResult {
  Recorded = 'Recorded',
  /** Already recorded (by an earlier try or on its due date). */
  AlreadyRecorded = 'AlreadyRecorded',
}
