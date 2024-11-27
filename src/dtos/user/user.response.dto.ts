import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from 'src/enums';
import { BaseSchema } from 'src/schemas/base.schema.dto';

export class UserResponse extends BaseSchema {
  @ApiProperty()
  name: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  membershipId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  constituency: string;

  @ApiProperty()
  constituencyCode: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  authenticated: boolean;

  @ApiProperty()
  profileImage: string;

  @ApiProperty()
  role: UserRole;

  @ApiProperty()
  status: UserStatus;
}
