import { UserResponse } from '../user/user.response.dto';

export class UserJwtDetails {
  id: string;
  phoneNumber: string;
  email: string;
  tokenId: string;
  user?: UserResponse;
}
