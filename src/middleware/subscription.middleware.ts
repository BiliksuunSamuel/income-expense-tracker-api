import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice } from 'src/schemas/invoice.schema';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from 'src/services/auth.service';
import { PaymentStatus } from 'src/enums';
import { toPaginationInfo } from 'src/utils';
import { Subscription } from 'src/schemas/subscription.schema';
import { Transaction } from 'src/schemas/transaction.schema';

@Injectable()
export class SubscriptionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SubscriptionMiddleware.name);
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    private readonly authService: AuthService,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Middleware logic here
      this.logger.log('Subscription middleware executed');
      const authInfo = await this.authService.getAuthDetails(req);
      if (!authInfo?.user) {
        this.logger.warn('User not authenticated');
        return res.status(401).send({ message: 'Unauthorized' });
      }

      const user = authInfo.user;
      const subscription = await this.subscriptionModel
        .findOne({
          userId: user.id,
          isActive: true,
        })
        .lean();

      if (!subscription) {
        this.logger.warn('No subscription found for user', user.id);
        return res.status(403).send({
          message:
            'You do not have an active subscription, please purchase one!',
        });
      }

      const invoice = await this.invoiceModel.findOne({
        subscriptionId: subscription.id,
      });

      if (!invoice) {
        this.logger.warn('No invoice found for subscription', subscription.id);
        return res.status(403).send({
          message: 'No valid invoice found for your subscription.',
        });
      }

      if (invoice.status !== PaymentStatus.Completed) {
        this.logger.warn(
          'Subscription payment not completed for invoice',
          invoice.id,
        );
        return res.status(403).send({
          message: 'Your subscription payment is not completed.',
        });
      }

      const query = req.query;

      if (query) {
        const paginationInfo = toPaginationInfo(query);
        req.query['page'] = paginationInfo.page as any;
        req.query['pageSize'] = paginationInfo.pageSize as any;
        this.logger.log('request query details', req.query);
      }

      // count transactions for user on the currenct subscription
      const transactionCount = await this.transactionModel.countDocuments({
        userId: user.id,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });

      if (transactionCount >= subscription.maxNumberOfTransactions) {
        this.logger.warn('Transaction limit reached for user', user.id);
        return res.status(403).send({
          message:
            'You have reached your transaction limit for this subscription. Please upgrade your plan to continue.',
        });
      }

      next();
    } catch (error) {
      this.logger.error('Error in subscription middleware', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  }
}
