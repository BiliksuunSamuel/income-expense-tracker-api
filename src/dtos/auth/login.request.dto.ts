import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username: string;
}
