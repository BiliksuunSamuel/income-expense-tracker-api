import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthResponse } from 'src/dtos/auth/auth.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { VerifyOtpRequest } from 'src/dtos/auth/verify.otp.request.dto';
import {
  accountVerificationMessage,
  generateId,
  generateOtp,
  hashPassword,
  verifyPassword,
} from 'src/utils';
import { toUserReponse } from 'src/extensions/user.entensions';
import { LoginRequest } from 'src/dtos/auth/login.request.dto';
import { NotificationsActor } from 'src/actors/notification.actor';
import { dispatch } from 'nact';
import { User } from 'src/schemas/user.schema.dto';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { GoogleAuthRequestDto } from 'src/dtos/auth/google.auth.request.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { UserRegisterRequest } from 'src/dtos/auth/user.register.request.dto';
import { UserStatus } from 'src/enums';
import { ProxyHttpService } from 'src/providers/proxy-http.service';
import configuration from 'src/configuration';
import { GoogleAuthUserRequestDto } from 'src/dtos/common/google.auth.user.request.dto';
import { GoogleAuthUserInfo } from 'src/dtos/auth/google.auth.user.info.dto';
import { ResetPasswordRequestDto } from 'src/dtos/auth/reset.password.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CurrencyRequest } from 'src/dtos/user/currency.request.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userRepository: Model<User>,
    private readonly userRepo: UserRepository,
    private readonly notificationActor: NotificationsActor,
    private readonly proxyHttpService: ProxyHttpService,
  ) {}

  //update user currency
  async updateUserCurrencyAsync(
    userId: string,
    request: CurrencyRequest,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const user = await this.userRepo.getByIdAsync(userId);
      if (!user) {
        return CommonResponses.NotFoundResponse<AuthResponse>();
      }
      user.currency = request.code;
      user.currencyName = request.name;
      user.updatedAt = new Date();
      user.updatedBy = userId;
      user.tokenId = generateId();
      const res = await this.userRepo.updateAsync(user.email, user);
      if (!res) {
        return CommonResponses.InternalServerErrorResponse<AuthResponse>(
          'An error occurred while updating user currency',
        );
      }
      return CommonResponses.OkResponse<AuthResponse>(
        {
          user: toUserReponse(user),
          token: await this.generateToken({
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            tokenId: user.tokenId,
          }),
        },
        'User currency updated successfully',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while updating user currency\n',
        userId,
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<AuthResponse>(
        'An error occurred while updating user currency',
      );
    }
  }

  //handle reset password
  async resetPassword(
    request: ResetPasswordRequestDto,
    auth: UserJwtDetails,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      if (request.password !== request.confirmPassword) {
        return {
          message: 'Password do not match',
          code: HttpStatus.CONFLICT,
        };
      }

      const user = await this.userRepository.findOne({ id: auth.id }).lean();
      if (!user) {
        return {
          message: 'Account not found',
          code: HttpStatus.NOT_FOUND,
        };
      }
      user.password = await hashPassword(request.password);
      user.updatedAt = new Date();
      user.isLoggedIn = true;
      user.updatedBy = auth.email;
      user.tokenId = generateId();
      user.authenticated = true;
      user.resetPassword = false;
      const { _id, ...others } = user as any;
      const res = await this.userRepo.updateAsync(user.email, { ...others });
      if (!res) {
        return {
          message: 'An error occurred while authenticating account',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }
      const response: AuthResponse = {
        user: toUserReponse(user),
        token: await this.generateToken({
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          tokenId: user.tokenId,
        }),
      };
      return {
        message: 'Password reset successful',
        code: HttpStatus.OK,
        data: response,
      };
    } catch (error) {
      this.logger.error('an error occurred resetting customer password', error);
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  //handle forgot password
  async forgotPassword(email: string): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const user = await this.userRepo.getByEmailAsync(email);
      if (!user) {
        return {
          message: 'Email not found',
          code: HttpStatus.NOT_FOUND,
        };
      }
      user.verificationCode = generateOtp();
      user.updatedAt = new Date();
      user.isLoggedIn = false;
      user.tokenId = generateId();
      user.authenticated = false;
      user.resetPassword = true;
      const { _id, ...others } = user as any;
      const res = await this.userRepo.updateAsync(user.email, { ...others });
      if (!res) {
        return {
          message: 'Sorry,an error occured',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }
      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.email,
        message: accountVerificationMessage(user.verificationCode),
      });
      const payload: UserJwtDetails = {
        id: user.id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        tokenId: user.tokenId,
      };
      return {
        code: HttpStatus.OK,
        data: {
          user: toUserReponse({
            ...user,
            isLoggedIn: false,
          }),
          token: await this.jwtService.signAsync(payload),
        },
      };
    } catch (error) {
      this.logger.error('an error occurred while resetting password', error);
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  //handle google auth
  async googleAuth(
    request: GoogleAuthUserRequestDto,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const googleUserInfo =
        await this.proxyHttpService.request<GoogleAuthUserInfo>({
          method: 'get',
          url: configuration().googleAuthUrl,
          token: request.accessToken,
        });
      if (!googleUserInfo) {
        return {
          message: 'An error occurred while authenticating account',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }
      const data: GoogleAuthRequestDto = {
        email: googleUserInfo.email,
        picture: googleUserInfo.picture,
        firstName: googleUserInfo.given_name,
        lastName: googleUserInfo.family_name,
        accessToken: request.accessToken,
        emailVerified: googleUserInfo.email_verified,
      };
      const user = await this.userRepo.handleGoogleAuthAsync(data);
      if (!user) {
        return {
          message: 'An error occurred while authenticating account',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }
      const response: AuthResponse = {
        user: toUserReponse(user),
        token: await this.generateToken({
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          tokenId: user.tokenId,
        }),
      };
      return {
        message: 'Account verification successful',
        code: HttpStatus.OK,
        data: response,
      };
    } catch (error) {
      this.logger.error(
        'an error occurred while authenticating account',
        error,
        request,
      );
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async registerUser(
    request: UserRegisterRequest,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const emailUser = await this.userRepo.getByEmailAsync(request.email);
      if (emailUser) {
        return {
          message: 'Email already exist',
          code: HttpStatus.CONFLICT,
        };
      }
      const newUser: User = {
        ...request,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isLoggedIn: false,
        verificationCode: generateOtp(),
        tokenId: generateId(),
        picture: null,
        status: UserStatus.Active,
        fcmToken: null,
        isGoogleAuth: false,
        googleAccessToken: null,
        password: await hashPassword(request.password),
        updatedBy: null,
        createdBy: request.email,
        phoneNumber: null,
        emailVerified: false,
        authenticated: false,
        resetPassword: false,
        otpExpiryTime: new Date(new Date().getTime() + 10 * 60000),
      };
      const user = await this.userRepo.addAsync(newUser);
      if (!user) {
        return {
          message: 'An error occurred while registering user',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }

      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.email,
        message: accountVerificationMessage(user.verificationCode),
      });

      const payload: UserJwtDetails = {
        id: user.id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        tokenId: user.tokenId,
      };
      return {
        code: HttpStatus.CREATED,
        data: {
          user: toUserReponse(user),
          token: await this.generateToken(payload),
        },
      };
    } catch (error) {
      this.logger.error('an error occurred while registering user', error);
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async verifyOtpCode(
    request: VerifyOtpRequest,
    auth: UserJwtDetails,
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const user = await this.userRepository.findOne({ id: auth.id }).lean();
      if (!user) {
        return {
          message: 'Account not found',
          code: HttpStatus.NOT_FOUND,
        };
      }

      if (user.otpExpiryTime < new Date()) {
        return {
          message: 'Verification code has expired',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      if (request.code !== user.verificationCode) {
        return {
          message: 'Invalid verification code',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      user.updatedAt = new Date();
      user.isLoggedIn = true;
      user.updatedBy = auth.email;
      user.verificationCode = generateOtp();
      user.tokenId = generateId();
      user.authenticated = true;
      user.emailVerified = true;
      const { _id, ...others } = user as any;
      const res = await this.userRepo.updateAsync(user.email, { ...others });
      if (!res) {
        return {
          message: 'An error occurred while authenticating account',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }
      const response: AuthResponse = {
        user: toUserReponse(user),
        token: await this.generateToken({
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          tokenId: user.tokenId,
        }),
      };
      return {
        message: 'Account verification successful',
        code: HttpStatus.OK,
        data: response,
      };
    } catch (error) {
      this.logger.error(
        'an error occurred verifying customer authentication code',
        error,
      );
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  //handle account logout
  async logout(user: UserJwtDetails): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const account = await this.userRepository
        .findOneAndUpdate(
          { id: user.id },
          {
            tokenId: generateId(),
            updatedAt: new Date(),
            authenticated: false,
            fcmToken: null,
            updatedBy: user.phoneNumber,
          },
        )
        .lean();
      if (!account) {
        return {
          message: 'Account not found',
          code: HttpStatus.NOT_FOUND,
        };
      }
      return {
        message: 'Logout successful',
        code: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error('an error occurred while logging out', error);
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  // resend verification code;
  async resendOtp(data: UserJwtDetails): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const user = await this.userRepository.findOne({ id: data.id }).lean();
      if (!user) {
        return {
          message: 'user not found',
          code: HttpStatus.NOT_FOUND,
        };
      }
      user.verificationCode = generateOtp();
      user.isLoggedIn = false;
      user.updatedAt = new Date();
      user.tokenId = generateId();
      user.authenticated = false;
      user.otpExpiryTime = new Date(new Date().getTime() + 10 * 60000);
      const { _id, ...others } = user as any;
      var res = await this.userRepo.updateAsync(user.email, { ...others });
      if (!res) {
        return {
          message: 'Sorry,an error occured',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }

      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.email,
        message: accountVerificationMessage(user.verificationCode),
      });

      const payload: UserJwtDetails = {
        id: user.id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        tokenId: user.tokenId,
      };
      return {
        code: HttpStatus.OK,
        data: {
          user: toUserReponse({
            ...user,
            isLoggedIn: false,
          }),
          token: await this.jwtService.signAsync(payload),
        },
      };
    } catch (error) {
      this.logger.error('an error occurred while resending otp', data, error);
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  //This method is called by the validateUser method
  async login(request: LoginRequest): Promise<ApiResponseDto<AuthResponse>> {
    try {
      let user = await this.userRepo.getByEmailAsync(request.email);
      if (!user) {
        return {
          message: 'Incorrect email address or password',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      if (user.isGoogleAuth) {
        return {
          message: 'Please login with your google account',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      var passwordMatch = await verifyPassword(request.password, user.password);
      if (!passwordMatch) {
        return {
          message: 'Incorrect email address or password',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      user.verificationCode = generateOtp();
      user.isLoggedIn = false;
      user.updatedAt = new Date();
      user.tokenId = generateId();
      user.updatedBy = user.email;
      user.updatedAt = new Date();
      user.resetPassword = false;
      user.otpExpiryTime = new Date(new Date().getTime() + 10 * 60000);
      const { _id, ...others } = user as any;
      const res = await this.userRepo.updateAsync(user.email, { ...others });

      if (!res) {
        return {
          message: 'Sorry,an error occured',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }

      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.email,
        message: accountVerificationMessage(user.verificationCode),
      });

      const payload: UserJwtDetails = {
        id: user.id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        tokenId: user.tokenId,
      };
      return {
        code: HttpStatus.OK,
        data: {
          user: toUserReponse({
            ...user,
            isLoggedIn: false,
          }),
          token: await this.jwtService.signAsync(payload),
        },
      };
    } catch (error) {
      this.logger.error('an error occurred during user login', error, request);
      return {
        message: 'sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async validateUser(username: string): Promise<User> {
    const user = null; // await this.userService.getByUsername(username);
    if (!user) {
      throw new HttpException(
        'Incorrect login email or phone number',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }

  async generateToken(payload: UserJwtDetails): Promise<string> {
    return await this.jwtService.signAsync(payload);
  }
}
