import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class UserRegisterRequest {
  @IsString()
  @IsEmail(
    {},
    { message: 'Email is required and must be a valid email address' },
  )
  @ApiProperty()
  readonly email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty()
  readonly password: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @ApiProperty()
  readonly firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @ApiProperty()
  readonly lastName: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  currencyName: string;
}
