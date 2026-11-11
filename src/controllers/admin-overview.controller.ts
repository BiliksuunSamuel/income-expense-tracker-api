import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminSessionGuard } from 'src/providers/admin-session.guard';
import { AdminOverviewService } from 'src/services/admin-overview.service';

/// The console's Overview page.
@Controller('api/admin/overview')
@ApiTags('Admin: overview')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  async get(@Res() res: Response) {
    const result = await this.overview.overview();
    res.status(result.code).send(result);
  }
}
