import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateFcmTokenRequest {
  @ApiProperty()
  @IsString()
  fcmToken: string;
}
