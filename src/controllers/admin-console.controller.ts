import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { AdminRole } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { AdminSessionGuard } from 'src/providers/admin-session.guard';
import { Admin } from 'src/schemas/admin.schema';
import { AdminAuditService } from 'src/services/admin-audit.service';
import { AdminBillingService } from 'src/services/admin-billing.service';
import { AdminRequest, AdminSetupService, PlanRequest } from 'src/services/admin-setup.service';
import { AdminUsersService } from 'src/services/admin-users.service';
import { pageOf } from 'src/utils/paging';

type WithAdmin = Request & { admin: Admin };

const send = (res: Response, result: ApiResponseDto<unknown>) => res.status(result.code).send(result);

/// Owners only: changing plans and who can sign in.
const ownerOnly = (req: WithAdmin) =>
  req.admin.role === AdminRole.Owner
    ? null
    : CommonResponses.ForbiddenResponse('Only an Owner can change this.');

/// Console › Users: people's accounts, plans and counts (never their entries).
@Controller('api/admin/users')
@ApiTags('Admin: users')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  async list(@Query() q: any, @Res() res: Response) {
    send(res, await this.users.list({ query: q.query, status: q.status, plan: q.plan }, pageOf(q)));
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Res() res: Response) {
    send(res, await this.users.detail(id));
  }

  @Post(':id/suspend')
  async suspend(@Req() req: WithAdmin, @Param('id') id: string, @Body() body: { reason?: string }, @Res() res: Response) {
    send(res, await this.users.suspend(req.admin, id, body?.reason));
  }

  @Post(':id/restore')
  async restore(@Req() req: WithAdmin, @Param('id') id: string, @Res() res: Response) {
    send(res, await this.users.restore(req.admin, id));
  }
}

/// Console › Payments, Invoices and Subscriptions.
@Controller('api/admin')
@ApiTags('Admin: billing')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get('payments')
  async payments(@Query() q: any, @Res() res: Response) {
    send(res, await this.billing.payments(q.tab ?? 'all', q.query, pageOf(q)));
  }

  @Get('invoices')
  async invoices(@Query() q: any, @Res() res: Response) {
    send(res, await this.billing.invoices(q.tab ?? 'all', q.query, pageOf(q)));
  }

  @Get('invoices/:id')
  async invoice(@Param('id') id: string, @Res() res: Response) {
    send(res, await this.billing.invoice(id));
  }

  /// Asks Paystack about the invoice's checkout now.
  @Post('invoices/:id/recheck')
  async recheck(@Req() req: WithAdmin, @Param('id') id: string, @Res() res: Response) {
    send(res, await this.billing.recheck(req.admin, id));
  }

  /// Records a refund made in Paystack.
  @Post('invoices/:id/refund')
  async refund(@Req() req: WithAdmin, @Param('id') id: string, @Body() body: { note?: string }, @Res() res: Response) {
    const denied = ownerOnly(req);
    send(res, denied ?? (await this.billing.markRefunded(req.admin, id, body?.note)));
  }

  @Get('subscriptions')
  async subscriptions(@Query() q: any, @Res() res: Response) {
    send(res, await this.billing.subscriptions(q.tab ?? 'running', q.query, pageOf(q)));
  }
}

/// Console › Billing plans and Admins.
@Controller('api/admin')
@ApiTags('Admin: setup')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
export class AdminSetupController {
  constructor(
    private readonly setup: AdminSetupService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('plans')
  async plans(@Res() res: Response) {
    send(res, await this.setup.plans());
  }

  @Post('plans')
  async createPlan(@Req() req: WithAdmin, @Body() body: PlanRequest, @Res() res: Response) {
    send(res, ownerOnly(req) ?? (await this.setup.createPlan(req.admin, body ?? {})));
  }

  @Patch('plans/:id')
  async updatePlan(@Req() req: WithAdmin, @Param('id') id: string, @Body() body: PlanRequest, @Res() res: Response) {
    send(res, ownerOnly(req) ?? (await this.setup.updatePlan(req.admin, id, body ?? {})));
  }

  @Get('admins')
  async admins(@Res() res: Response) {
    send(res, await this.setup.admins());
  }

  @Post('admins')
  async addAdmin(@Req() req: WithAdmin, @Body() body: AdminRequest, @Res() res: Response) {
    send(res, ownerOnly(req) ?? (await this.setup.addAdmin(req.admin, body ?? {})));
  }

  @Patch('admins/:id')
  async updateAdmin(@Req() req: WithAdmin, @Param('id') id: string, @Body() body: AdminRequest, @Res() res: Response) {
    send(res, ownerOnly(req) ?? (await this.setup.updateAdmin(req.admin, id, body ?? {})));
  }

  @Get('audit')
  async auditLog(@Query() q: any, @Res() res: Response) {
    send(res, await this.audit.list(pageOf(q), q.targetId));
  }
}
