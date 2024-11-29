import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthUserRequestDto {
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
