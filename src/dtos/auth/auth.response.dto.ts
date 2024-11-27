import { ApiProperty } from '@nestjs/swagger';

export class AuthResponse {
  @ApiProperty()
  user: any;
  @ApiProperty()
  token: string;
  @ApiProperty()
  prefix?: string;
}

export class AccountAuthResponse {
  @ApiProperty()
  user: any;
  @ApiProperty()
  token: string;
}
