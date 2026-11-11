import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';
import { AdminRole, AdminStatus } from 'src/enums';

/// Someone who can sign in to the console: by phone and a texted code. Kept
/// apart from app users, so console access never comes from an app account.
@Schema()
export class Admin extends BaseSchema {
  /// As 233XXXXXXXXX.
  @Prop({ required: true, type: String, unique: true })
  phoneNumber: string;

  @Prop({ type: String, default: '' })
  firstName: string;

  @Prop({ type: String, default: '' })
  lastName: string;

  @Prop({ type: String, enum: AdminRole, default: AdminRole.Admin })
  role: AdminRole;

  @Prop({ type: String, enum: AdminStatus, default: AdminStatus.Active })
  status: AdminStatus;

  @Prop({ type: String, default: null })
  verificationCodeHash: string | null;

  @Prop({ type: Date, default: null })
  verificationCodeExpiresAt: Date | null;

  @Prop({ type: Number, default: 0 })
  otpAttempts: number;

  @Prop({ type: Date, default: null })
  lastOtpSentAt: Date | null;

  @Prop({ type: Date, default: null })
  otpWindowStartedAt: Date | null;

  @Prop({ type: Number, default: 0 })
  otpSendsInWindow: number;

  /// The signed-in session; a new sign-in or sign-out replaces it, which
  /// ends the old one.
  @Prop({ type: String, default: null })
  sessionId: string | null;

  @Prop({ type: Date, default: null })
  lastSignedInAt: Date | null;
}
