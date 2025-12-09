import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginRequest {
  @ApiProperty()
  @IsEmail(
    {},
    { message: 'Email is required and must be a valid email address' },
  )
  readonly email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  readonly password: string;
}
