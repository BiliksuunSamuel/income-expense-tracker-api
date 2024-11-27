import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from '../user/user.response.dto';

export class AuthResponse {
  @ApiProperty()
  user: UserResponse;
  @ApiProperty()
  token: string;
}

export class AccountAuthResponse {
  @ApiProperty()
  user: any;
  @ApiProperty()
  token: string;
}
