import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from 'src/enums';
import { BaseSchema } from 'src/schemas/base.schema.dto';

export class UserResponse extends BaseSchema {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isLoggedIn: boolean;

  @ApiProperty()
  picture: string;

  @ApiProperty()
  status: UserStatus;

  @ApiProperty()
  currency: string;
}
