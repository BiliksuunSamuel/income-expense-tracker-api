import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from '../user/user.response.dto';
import { SubscriptionResponse } from '../billing-plan/subscription-response.dto';

export class AuthResponse {
  @ApiProperty()
  user: UserResponse;
  @ApiProperty()
  token: string;
  @ApiProperty()
  subscription?: SubscriptionResponse;
}

export class AccountAuthResponse {
  @ApiProperty()
  user: any;
  @ApiProperty()
  token: string;
}
