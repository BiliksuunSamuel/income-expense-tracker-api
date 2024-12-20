import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class BudgetRequest {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsBoolean()
  receiveAlert: boolean;

  @ApiProperty()
  @IsNotEmpty()
  receiveAlertPercentage: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;
}
