import { Body, Controller, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginRequest } from 'src/dtos/auth/login.request.dto';
import { JwtAuthGuard } from './jwt-auth..guard';
import { AuthUser } from 'src/extensions/auth.extensions';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { VerifyOtpRequest } from 'src/dtos/auth/verify.otp.request.dto';
import { formatPhoneNumber } from 'src/utils';

@Controller('api/authentication')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Patch('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@AuthUser() user: UserJwtDetails, @Res() response: Response) {
    const res = await this.authService.logout(user);
    response.status(res.code).send(res);
  }

  @Post('login')
  async login(@Body() req: LoginRequest, @Res() response: Response) {
    const phoneNumberValidationResults = formatPhoneNumber(req.username);
    if (!phoneNumberValidationResults.isValid) {
      response.status(400).send({
        message: 'Invalid phone number',
        code: 400,
      });
      return;
    }

    req.username = phoneNumberValidationResults.validNumber;
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
}
