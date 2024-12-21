import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthUserRequestDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  fcmToken: string;
}
