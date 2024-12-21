import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRequest } from 'src/dtos/auth/login.request.dto';
import { JwtAuthGuard } from './jwt-auth..guard';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { VerifyOtpRequest } from 'src/dtos/auth/verify.otp.request.dto';
import { UserRegisterRequest } from 'src/dtos/auth/user.register.request.dto';
import { GoogleAuthUserRequestDto } from 'src/dtos/common/google.auth.user.request.dto';
import { ResetPasswordRequestDto } from 'src/dtos/auth/reset.password.request.dto';
import { ForgotPasswordRequestDto } from 'src/dtos/auth/forgot.password.request.dto';
import { CurrencyRequest } from 'src/dtos/user/currency.request.dto';
import { UpdateFcmTokenRequest } from 'src/dtos/user/update.fcm.token.request.dto';

@Controller('api/authentication')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //handle update user fcm token
  @Patch('fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateUserFcmToken(
    @AuthUser() user: UserJwtDetails,
    @Body() request: UpdateFcmTokenRequest,
    @Res() response: Response,
  ) {
    const res = await this.authService.updateUserFcmTokenAsync(
      user.id,
      request.fcmToken,
    );
    response.status(res.code).send(res);
  }

  //get profile
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.authService.getProfile(user);
    response.status(res.code).send(res);
  }

  //update user currency
  @Patch('update-currency')
  @UseGuards(JwtAuthGuard)
  async updateUserCurrency(
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
    @Body() currency: CurrencyRequest,
  ) {
    const res = await this.authService.updateUserCurrencyAsync(
      user.id,
      currency,
    );
    response.status(res.code).send(res);
  }

  @Post('register')
  async register(@Body() req: UserRegisterRequest, @Res() response: Response) {
    const res = await this.authService.registerUser(req);
    response.status(res.code).send(res);
  }

  @Post('google-auth')
  async googleAuth(
    @Body() req: GoogleAuthUserRequestDto,
    @Res() response: Response,
  ) {
    const res = await this.authService.googleAuth(req);
    response.status(res.code).send(res);
  }

  @Patch('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@AuthUser() user: UserJwtDetails, @Res() response: Response) {
    const res = await this.authService.logout(user);
    response.status(res.code).send(res);
  }

  @Post('login')
  async login(@Body() req: LoginRequest, @Res() response: Response) {
    const res = await this.authService.login(req);
    response.status(res.code).send(res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('otp-resend')
  async resendOtp(@AuthUser() user: UserJwtDetails, @Res() response: Response) {
    const res = await this.authService.resendOtp(user);
    response.status(res.code).send(res);
  }

  @Patch('otp-verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @Body() request: VerifyOtpRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.authService.verifyOtpCode(request, user);
    response.status(res.code).send(res);
  }

  @Patch('forgot-password')
  async forgotPassword(
    @Body() req: ForgotPasswordRequestDto,
    @Res() response: Response,
  ) {
    const res = await this.authService.forgotPassword(req.email);
    response.status(res.code).send(res);
  }

  @Patch('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @Body() req: ResetPasswordRequestDto,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.authService.resetPassword(req, user);
    response.status(res.code).send(res);
  }
}
