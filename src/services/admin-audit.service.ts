import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Admin } from 'src/schemas/admin.schema';
import { AuditEntry } from 'src/schemas/audit-entry.schema';
import { generateId } from 'src/utils';
import { paged } from 'src/utils/paging';

/// The audit log: every change an admin makes in the console.
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);
  constructor(
    @InjectModel(AuditEntry.name)
    private readonly auditModel: Model<AuditEntry>,
  ) {}

  /// Writes an entry; a failure is logged, never thrown at the action.
  async record(
    admin: Admin,
    action: string,
    target: { type: string; id: string } | null,
    summary: string,
  ): Promise<void> {
    try {
      await this.auditModel.create({
        id: generateId(),
        createdAt: new Date(),
        createdBy: admin.id,
        adminId: admin.id,
        adminName: AdminAuditService.nameOf(admin),
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        summary,
      });
    } catch (error) {
      this.logger.error('Could not write the audit entry', { action }, error);
    }
  }

  async list(
    page: { page: number; pageSize: number },
    targetId?: string,
  ): Promise<ApiResponseDto<PagedResults<AuditEntry>>> {
    try {
      const filter = targetId ? { targetId } : {};
      return CommonResponses.OkResponse(await paged(this.auditModel, filter, page));
    } catch (error) {
      this.logger.error('Error listing the audit log', error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  static nameOf(admin: Pick<Admin, 'firstName' | 'lastName' | 'phoneNumber'>): string {
    return `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || admin.phoneNumber;
  }
}
