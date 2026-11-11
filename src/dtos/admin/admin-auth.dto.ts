import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginRequest {
  @ApiProperty({ example: '0241234567' })
  phoneNumber: string;
}

export class AdminVerifyRequest {
  @ApiProperty({ example: '123456' })
  verificationCode: string;
}
