import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class VerifyOtpRequest {
  @ApiProperty()
  @IsNotEmpty()
  code: string;
}
