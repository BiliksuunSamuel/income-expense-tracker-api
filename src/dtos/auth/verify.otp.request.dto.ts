import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VerifyOtpRequest {
  @ApiProperty()
  @IsNotEmpty()
  prefix: string;
  @ApiProperty()
  @IsNotEmpty()
  code: string;
}
