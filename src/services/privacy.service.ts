import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { FileContentResponse } from 'src/dtos/common/file-content-response';
import { SubscriptionStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Account } from 'src/schemas/account.schema';
import { Budget } from 'src/schemas/budget.schema';
import { BudgetCategory } from 'src/schemas/budget.category.schema';
import { Category } from 'src/schemas/category.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { RecurringTransaction } from 'src/schemas/recurring.transaction.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { Transaction } from 'src/schemas/transaction.schema';
import { Transfer } from 'src/schemas/transfer.schema';
import { User } from 'src/schemas/user.schema';
import { ImageService } from 'src/services/image.service';
import {
  DELETE_CONFIRMATION,
  clean,
  cloudinaryPublicId,
  withoutPrivateFields,
} from 'src/utils/privacy';

/** Downloading everything the app holds about a user, and deleting it. */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Transaction.name)
    private readonly transactions: Model<Transaction>,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(Transfer.name) private readonly transfers: Model<Transfer>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Budget.name) private readonly budgets: Model<Budget>,
    @InjectModel(BudgetCategory.name)
    private readonly budgetCategories: Model<BudgetCategory>,
    @InjectModel(RecurringTransaction.name)
    private readonly repeats: Model<RecurringTransaction>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    private readonly imageService: ImageService,
  ) {}

  /** Everything stored for the user as one JSON file. */
  async exportData(
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<FileContentResponse>> {
    try {
      const id = user.id;
      const [
        profile,
        transactions,
        accounts,
        transfers,
        categories,
        budgets,
        budgetCategories,
        repeats,
        subscriptions,
        invoices,
      ] = await Promise.all([
        this.users.findOne({ id }).lean(),
        this.transactions.find({ userId: id }).sort({ createdAt: 1 }).lean(),
        this.accounts.find({ userId: id }).lean(),
        this.transfers.find({ userId: id }).sort({ createdAt: 1 }).lean(),
        this.categories.find({ creatorId: id }).lean(),
        this.budgets.find({ createdBy: id }).lean(),
        this.budgetCategories.find({ createdBy: id }).lean(),
        this.repeats.find({ userId: id }).lean(),
        this.subscriptions.find({ userId: id }).lean(),
        this.invoices.find({ userId: id }).lean(),
      ]);
      if (!profile)
        return CommonResponses.NotFoundResponse('Account not found');
      const bundle = {
        exportedAt: new Date().toISOString(),
        profile: withoutPrivateFields(profile),
        accounts: clean(accounts),
        categories: clean(categories),
        transactions: clean(transactions),
        transfers: clean(transfers),
        repeats: clean(repeats),
        budgets: clean(budgets),
        budgetCategories: clean(budgetCategories),
        subscriptions: clean(subscriptions),
        invoices: clean(invoices),
      };
      const day = new Date().toISOString().slice(0, 10);
      return CommonResponses.OkResponse(
        new FileContentResponse(
          Buffer.from(JSON.stringify(bundle, null, 2), 'utf8').toString(
            'base64',
          ),
          `ie-tracker-data-${day}.json`,
          'application/json',
        ),
      );
    } catch (error) {
      this.logger.error('could not export user data', user.id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while preparing your data',
      );
    }
  }

  /** Deletes the account and everything in it. Payment records (invoices)
   * are kept for accounting, without the user's name or contact details. */
  async deleteAccount(
    user: UserJwtDetails,
    confirm: unknown,
  ): Promise<ApiResponseDto<boolean>> {
    if (confirm !== DELETE_CONFIRMATION) {
      return CommonResponses.BadRequestResponse(
        false,
        `Send confirm: "${DELETE_CONFIRMATION}" to delete the account`,
      );
    }
    const id = user.id;
    try {
      const receipts = await this.transactions
        .find(
          { userId: id, invoiceUrl: { $type: 'string' } },
          { invoiceUrl: 1 },
        )
        .lean();

      await Promise.all([
        this.transactions.deleteMany({ userId: id }),
        this.accounts.deleteMany({ userId: id }),
        this.transfers.deleteMany({ userId: id }),
        this.categories.deleteMany({ creatorId: id }),
        this.budgets.deleteMany({ createdBy: id }),
        this.budgetCategories.deleteMany({ createdBy: id }),
        this.repeats.deleteMany({ userId: id }),
        // No more renewal invoices.
        this.subscriptions.updateMany(
          { userId: id },
          { isActive: false, status: SubscriptionStatus.Cancelled },
        ),
        this.invoices.updateMany({ userId: id }, { description: null }),
      ]);
      // Last, so a failure above can be retried while still signed in.
      await this.users.deleteOne({ id });

      // Receipt photos: best effort, after the account is gone.
      for (const r of receipts) {
        const publicId = cloudinaryPublicId(r.invoiceUrl);
        if (!publicId) continue;
        this.imageService
          .deleteCloudinaryImage({ id: publicId, url: r.invoiceUrl })
          .catch((e) =>
            this.logger.warn(`could not delete receipt ${publicId}`, e),
          );
      }
      this.logger.log(`deleted account ${id}`);
      return CommonResponses.OkResponse(true, 'Account deleted');
    } catch (error) {
      this.logger.error('could not delete account', id, error);
      return CommonResponses.InternalServerErrorResponse(
        'An error occurred while deleting your account. Please try again.',
      );
    }
  }
}
