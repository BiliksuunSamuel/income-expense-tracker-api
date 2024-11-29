import { IsStrongPassword } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsStrongPassword()
  password: string;

  @IsStrongPassword()
  confirmPassword: string;
}
