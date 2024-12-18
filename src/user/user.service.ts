import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { AuthResponse } from 'src/dtos/auth/auth.response.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { UserRepository } from 'src/repositories/user.repository';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly userRepository: UserRepository) {}

  //update user currency
  async updateUserCurrencyAsync(
    userId: string,
    currency: string,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
    } catch (error) {
      this.logger.error(
        'an error occurred while updating user currency\n',
        userId,
        currency,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<AuthResponse>(
        'An error occurred while updating user currency',
      );
    }
  }
}
