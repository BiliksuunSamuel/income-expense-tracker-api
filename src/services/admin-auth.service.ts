import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { dispatch } from 'nact';
import { NotificationsActor } from 'src/actors/notification.actor';
import { ApiResponseDto } from 'src/common/api.response.dto';
import configuration from 'src/configuration';
import { OtpPolicy } from 'src/constants/otp.policy';
import { AdminRole, AdminStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Admin } from 'src/schemas/admin.schema';
import { formatPhoneNumber, generateId, generateOtp } from 'src/utils';
import { hashOtp, otpMatches } from 'src/utils/otp';

/// What a token says: a sign-in waiting for its code, or a console session.
export type AdminTokenPayload =
  | { sub: string; kind: 'admin-pending' }
  | { sub: string; kind: 'admin'; sid: string };

/// The sign-in response; `token` is the pending token until the code is
/// checked, then the session token.
export type AdminAuthResponse = {
  token: string | null;
  phoneNumber: string;
  verificationCodeExpiresAt: Date | null;
  resendAfterSeconds: number;
};

export type AdminProfile = Pick<
  Admin,
  'id' | 'phoneNumber' | 'firstName' | 'lastName' | 'role' | 'createdAt'
>;

const PENDING_TTL = '10m';

/// Console sign-in: an admin's phone number, then a code texted to it. Codes
/// are stored hashed, expire after 5 minutes, allow 5 guesses, and are
/// rate-limited per number (OtpPolicy). A session lasts `admin.sessionHours`
/// and ends early on sign-out or a newer sign-in.
@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly jwtService: JwtService,
    private readonly notificationActor: NotificationsActor,
  ) {}

  /// The first Owner, from FirstAdminPhone, while there are no admins.
  async onModuleInit() {
    try {
      const phone = configuration().admin.firstAdminPhone;
      if (!phone || (await this.adminModel.countDocuments({})) > 0) return;
      const { isValid, validNumber } = formatPhoneNumber(phone);
      if (!isValid) {
        this.logger.error('FirstAdminPhone is not a valid number');
        return;
      }
      await this.adminModel.create({
        id: generateId(),
        phoneNumber: validNumber,
        role: AdminRole.Owner,
        status: AdminStatus.Active,
        createdAt: new Date(),
        createdBy: 'system',
      });
      this.logger.log('Created the first Owner from FirstAdminPhone');
    } catch (error) {
      this.logger.error('Could not create the first Owner', error);
    }
  }

  /// Step 1: texts a code to an admin's number. Other numbers are refused.
  async login(
    phoneNumber: string,
    now = new Date(),
  ): Promise<ApiResponseDto<AdminAuthResponse>> {
    try {
      const phone = this.parsePhone(phoneNumber);
      if (!phone) {
        return CommonResponses.BadRequestResponse(
          null,
          'Enter a valid phone number.',
        );
      }
      const admin = await this.adminModel
        .findOne({ phoneNumber: phone })
        .lean();
      if (!admin || admin.status !== AdminStatus.Active) {
        return CommonResponses.ForbiddenResponse(
          "This number can't sign in to the console.",
        );
      }
      const sent = await this.sendCode(admin, now);
      if ('wait' in sent) return sent.wait;
      return CommonResponses.OkResponse(
        {
          token: await this.jwtService.signAsync(
            { sub: admin.id, kind: 'admin-pending' },
            { expiresIn: PENDING_TTL },
          ),
          phoneNumber: admin.phoneNumber,
          verificationCodeExpiresAt: sent.expiresAt,
          resendAfterSeconds: OtpPolicy.resendCooldownMs / 1000,
        },
        'We sent you a code',
      );
    } catch (error) {
      this.logger.error('Error starting admin sign-in', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  /// A new code for a sign-in under way.
  async resend(
    adminId: string,
    now = new Date(),
  ): Promise<ApiResponseDto<AdminAuthResponse>> {
    try {
      const admin = await this.activeAdmin(adminId);
      if (!admin) return CommonResponses.UnauthorizedResponse('Start again.');
      const sent = await this.sendCode(admin, now);
      if ('wait' in sent) return sent.wait;
      return CommonResponses.OkResponse(
        {
          token: null,
          phoneNumber: admin.phoneNumber,
          verificationCodeExpiresAt: sent.expiresAt,
          resendAfterSeconds: OtpPolicy.resendCooldownMs / 1000,
        },
        'We sent you a new code',
      );
    } catch (error) {
      this.logger.error('Error resending admin code', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  /// Step 2: the right code starts a session (and ends any other).
  async verify(
    adminId: string,
    code: string,
    now = new Date(),
  ): Promise<ApiResponseDto<AdminAuthResponse>> {
    try {
      const admin = await this.activeAdmin(adminId);
      if (!admin?.verificationCodeHash) {
        return CommonResponses.UnauthorizedResponse(
          'That code has ended. Ask for a new one.',
        );
      }
      if (
        !admin.verificationCodeExpiresAt ||
        new Date(admin.verificationCodeExpiresAt) < now
      ) {
        await this.forgetCode(admin.id);
        return CommonResponses.UnauthorizedResponse(
          'That code has expired. Ask for a new one.',
        );
      }
      if (!otpMatches(String(code ?? ''), admin.verificationCodeHash)) {
        const attempts = (admin.otpAttempts ?? 0) + 1;
        if (attempts >= OtpPolicy.maxAttempts) {
          await this.forgetCode(admin.id);
          return CommonResponses.UnauthorizedResponse(
            'Too many wrong codes. Ask for a new one.',
          );
        }
        await this.adminModel.updateOne(
          { id: admin.id },
          { otpAttempts: attempts },
        );
        return CommonResponses.UnauthorizedResponse("That code isn't right.");
      }

      const sid = generateId();
      await this.adminModel.updateOne(
        { id: admin.id },
        {
          verificationCodeHash: null,
          verificationCodeExpiresAt: null,
          otpAttempts: 0,
          sessionId: sid,
          lastSignedInAt: now,
          updatedAt: now,
        },
      );
      const token = await this.jwtService.signAsync(
        { sub: admin.id, kind: 'admin', sid },
        { expiresIn: `${configuration().admin.sessionHours}h` },
      );
      return CommonResponses.OkResponse(
        {
          token,
          phoneNumber: admin.phoneNumber,
          verificationCodeExpiresAt: null,
          resendAfterSeconds: 0,
        },
        'Signed in',
      );
    } catch (error) {
      this.logger.error('Error checking admin code', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  async profile(adminId: string): Promise<ApiResponseDto<AdminProfile>> {
    const admin = await this.activeAdmin(adminId);
    if (!admin) return CommonResponses.UnauthorizedResponse();
    const { id, phoneNumber, firstName, lastName, role, createdAt } = admin;
    return CommonResponses.OkResponse({
      id,
      phoneNumber,
      firstName,
      lastName,
      role,
      createdAt,
    });
  }

  async signOut(adminId: string): Promise<ApiResponseDto<boolean>> {
    await this.adminModel.updateOne(
      { id: adminId },
      { sessionId: null, updatedAt: new Date() },
    );
    return CommonResponses.OkResponse(true, 'Signed out');
  }

  /// [token]'s admin when it is a live session (or, with [pending], a sign-in
  /// waiting for its code); null otherwise.
  async adminForToken(
    token: string | undefined,
    pending = false,
  ): Promise<Admin | null> {
    if (!token) return null;
    try {
      const payload =
        await this.jwtService.verifyAsync<AdminTokenPayload>(token);
      if (payload.kind !== (pending ? 'admin-pending' : 'admin')) return null;
      const admin = await this.activeAdmin(payload.sub);
      if (!admin) return null;
      if (payload.kind === 'admin' && admin.sessionId !== payload.sid) {
        return null;
      }
      return admin;
    } catch {
      return null;
    }
  }

  /// Makes and texts a code, within the limits; or the response to wait.
  private async sendCode(
    admin: Admin,
    now: Date,
  ): Promise<{ expiresAt: Date } | { wait: ApiResponseDto<any> }> {
    const last = admin.lastOtpSentAt
      ? new Date(admin.lastOtpSentAt).getTime()
      : 0;
    const sinceLast = now.getTime() - last;
    if (last && sinceLast < OtpPolicy.resendCooldownMs) {
      const seconds = Math.ceil((OtpPolicy.resendCooldownMs - sinceLast) / 1000);
      return { wait: tooMany(`Wait ${seconds}s before asking for another code.`) };
    }
    let windowStart = admin.otpWindowStartedAt
      ? new Date(admin.otpWindowStartedAt)
      : now;
    let sends = admin.otpSendsInWindow ?? 0;
    if (now.getTime() - windowStart.getTime() > OtpPolicy.windowMs) {
      windowStart = now;
      sends = 0;
    }
    if (sends >= OtpPolicy.maxSendsPerWindow) {
      return { wait: tooMany('Too many codes. Try again in an hour.') };
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + OtpPolicy.ttlMs);
    await this.adminModel.updateOne(
      { id: admin.id },
      {
        verificationCodeHash: hashOtp(code),
        verificationCodeExpiresAt: expiresAt,
        otpAttempts: 0,
        lastOtpSentAt: now,
        otpWindowStartedAt: windowStart,
        otpSendsInWindow: sends + 1,
      },
    );
    this.sendSms(
      admin.phoneNumber,
      `${code} is your IE Tracker console code. It expires in 5 minutes. Don't share it.`,
      code,
    );
    return { expiresAt };
  }

  /// Texts [message]. With no SMS provider set up outside production, the
  /// code goes to the log instead, so sign-in works locally.
  private sendSms(to: string, message: string, code: string) {
    if (!configuration().sms.smsApi) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`SMS isn't set up; the console code is ${code}`);
      } else {
        this.logger.error("SMS isn't set up (LetsFishSmsApi); no code sent");
      }
      return;
    }
    dispatch(this.notificationActor.sendSmsNotification, {
      recipients: [to],
      message,
    });
  }

  private forgetCode(adminId: string) {
    return this.adminModel.updateOne(
      { id: adminId },
      { verificationCodeHash: null, verificationCodeExpiresAt: null, otpAttempts: 0 },
    );
  }

  private activeAdmin(id: string): Promise<Admin | null> {
    return this.adminModel
      .findOne({ id, status: AdminStatus.Active })
      .lean();
  }

  private parsePhone(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const { isValid, validNumber } = formatPhoneNumber(raw.trim());
      return isValid ? validNumber : null;
    } catch {
      return null;
    }
  }
}

function tooMany(message: string): ApiResponseDto<any> {
  return { code: 429, message, data: null } as ApiResponseDto<any>;
}
