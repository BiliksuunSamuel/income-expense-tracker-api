import { UserResponse } from 'src/dtos/user/user.response.dto';
import { User } from 'src/schemas/user.schema.dto';

export function toUserReponse(user: User): UserResponse {
  const { googleAccessToken, verificationCode, fcmToken, password, ...others } =
    user;
  return others;
}
