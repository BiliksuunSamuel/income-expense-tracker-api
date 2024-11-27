import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { UserRole, UserStatus } from 'src/enums';

export class UpdateUserRequest {
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
  constituency: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  @IsNotEmpty()
  constituencyId: string;

  @ApiProperty()
  @IsNotEmpty()
  pollingStation: string;

  @ApiProperty()
  @IsNotEmpty()
  pollingStationCode: string;

  @ApiProperty()
  @IsNotEmpty()
  pollingStationId: string;

  @ApiProperty()
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty()
  @IsNotEmpty()
  status: UserStatus;
}
