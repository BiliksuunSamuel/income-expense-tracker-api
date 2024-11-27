import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
import { UserService } from 'src/user/user.service';
import { NotificationsActor } from 'src/actors/notification.actor';
import { dispatch } from 'nact';
import { User } from 'src/schemas/user.schema.dto';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { GoogleAuthRequestDto } from 'src/dtos/auth/google.auth.request.dto';
import { UserRepository } from 'src/repositories/user.repository';
import { UserRegisterRequest } from 'src/dtos/auth/user.register.request.dto';
import { UserStatus } from 'src/enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    @InjectModel(User.name) private readonly userRepository: Model<User>,
    private readonly userRepo: UserRepository,
    private readonly notificationActor: NotificationsActor,
  ) {}

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
      };
      const user = await this.userRepo.addAsync(newUser);
      if (!user) {
        return {
          message: 'An error occurred while registering user',
          code: HttpStatus.FAILED_DEPENDENCY,
        };
      }

      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.phoneNumber,
        message: accountVerificationMessage('', user.verificationCode),
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
      const doc = await this.userRepository.updateOne({ id: user.id }, user);
      if (!doc) {
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
      //await this.userService.updateAsync(user);

      dispatch(this.notificationActor.smsNotificationActor, {
        to: user.phoneNumber,
        message: accountVerificationMessage('', user.verificationCode),
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
        message: accountVerificationMessage('', user.verificationCode),
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

  //
  async googleLogin(req: any): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const request = req.user as GoogleAuthRequestDto;
      const user = await this.userRepo.handleGoogleAuthAsync(request);
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
        'an error occurred while logging in with google',
        error,
      );
      return {
        message: 'Sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
