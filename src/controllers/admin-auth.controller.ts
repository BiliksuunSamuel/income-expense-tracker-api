import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  AdminLoginRequest,
  AdminVerifyRequest,
} from 'src/dtos/admin/admin-auth.dto';
import {
  AdminPendingGuard,
  AdminSessionGuard,
} from 'src/providers/admin-session.guard';
import { Admin } from 'src/schemas/admin.schema';
import { AdminAuthService } from 'src/services/admin-auth.service';

type AdminRequest = Request & { admin: Admin };

/// Console sign-in: phone number, then the texted code.
@Controller('api/admin/auth')
@ApiTags('Admin: sign-in')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  /// Texts a code; answers with a pending token for the next two calls.
  @Post('login')
  async login(@Body() body: AdminLoginRequest, @Res() res: Response) {
    const result = await this.auth.login(body?.phoneNumber);
    res.status(result.code).send(result);
  }

  @Post('resend-otp')
  @ApiBearerAuth()
  @UseGuards(AdminPendingGuard)
  async resend(@Req() req: AdminRequest, @Res() res: Response) {
    const result = await this.auth.resend(req.admin.id);
    res.status(result.code).send(result);
  }

  /// The right code answers with the session token.
  @Post('verify-otp')
  @ApiBearerAuth()
  @UseGuards(AdminPendingGuard)
  async verify(
    @Req() req: AdminRequest,
    @Body() body: AdminVerifyRequest,
    @Res() res: Response,
  ) {
    const result = await this.auth.verify(req.admin.id, body?.verificationCode);
    res.status(result.code).send(result);
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async profile(@Req() req: AdminRequest, @Res() res: Response) {
    const result = await this.auth.profile(req.admin.id);
    res.status(result.code).send(result);
  }

  @Post('sign-out')
  @ApiBearerAuth()
  @UseGuards(AdminSessionGuard)
  async signOut(@Req() req: AdminRequest, @Res() res: Response) {
    const result = await this.auth.signOut(req.admin.id);
    res.status(result.code).send(result);
  }
}
