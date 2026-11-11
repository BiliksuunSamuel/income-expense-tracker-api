import { Prop, Schema } from '@nestjs/mongoose';
import { BaseSchema } from '.';

/// One thing an admin did in the console, kept for the audit log.
@Schema()
export class AuditEntry extends BaseSchema {
  @Prop({ required: true, type: String, index: true })
  adminId: string;

  /// The admin's name (or number) when they did it.
  @Prop({ required: true, type: String })
  adminName: string;

  /// e.g. "user.suspend", "invoice.refund", "plan.update".
  @Prop({ required: true, type: String, index: true })
  action: string;

  @Prop({ type: String, default: null })
  targetType: string | null;

  @Prop({ type: String, default: null, index: true })
  targetId: string | null;

  /// What happened, in words, for the log.
  @Prop({ required: true, type: String })
  summary: string;
}
