import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from 'src/services/auth.service';
import { BillingCycleService } from 'src/services/billing-cycle.service';
import { toPaginationInfo } from 'src/utils';

/// Requests that add an entry, which the plan's monthly limit counts.
const ADDS_ENTRY = [
  /^\/api\/transactions\/?$/,
  /^\/api\/recurring-transactions\/[^/]+\/pay\/?$/,
];

/// Lets a request through on the user's current plan (see
/// BillingCycleService): a lapsed paid plan is already back on Regular here.
/// Only adding an entry is refused when this month's entries are used up;
/// reading and editing what's there always works.
@Injectable()
export class SubscriptionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SubscriptionMiddleware.name);
  constructor(
    private readonly authService: AuthService,
    private readonly billing: BillingCycleService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authInfo = await this.authService.getAuthDetails(req);
      if (!authInfo?.user) {
        return res.status(401).send({ message: 'Unauthorized' });
      }

      const access = await this.billing.access(authInfo.user.id);
      if (!access) {
        return res.status(403).send({
          message:
            'You do not have an active subscription, please purchase one!',
        });
      }

      if (req.query) {
        const paginationInfo = toPaginationInfo(req.query);
        req.query['page'] = paginationInfo.page as any;
        req.query['pageSize'] = paginationInfo.pageSize as any;
      }

      const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
      const limit = access.subscription.maxNumberOfTransactions;
      if (
        req.method === 'POST' &&
        ADDS_ENTRY.some((pattern) => pattern.test(path)) &&
        limit > 0 &&
        (await access.entriesThisMonth()) >= limit
      ) {
        const month = new Date().toLocaleDateString('en-GB', {
          month: 'long',
          timeZone: 'UTC',
        });
        return res.status(403).send({
          message: `You've used all ${limit} entries for ${month} on ${access.subscription.planTitle}. Upgrade your plan for more, or add more next month.`,
        });
      }

      next();
    } catch (error) {
      this.logger.error('Error in subscription middleware', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  }
}
