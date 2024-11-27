import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { UserRole, UserStatus } from 'src/enums';

export class CreateUserRequest {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsPhoneNumber('GH')
  phoneNumber: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  membershipId: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty()
  @IsNotEmpty()
  status: UserStatus;

  @IsNotEmpty()
  @ApiProperty()
  constituency: string;

  @IsNotEmpty()
  @ApiProperty()
  constituencyCode: string;
}
