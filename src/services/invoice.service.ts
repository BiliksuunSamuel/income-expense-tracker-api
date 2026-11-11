import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { BaseFilter } from 'src/common/base.filter.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import configuration from 'src/configuration';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { InvoiceFilter } from 'src/dtos/invoices/invoice-filter.dto';
import { InvoiceKind, PaymentStatus, SubscriptionStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { BillingPlan } from 'src/schemas/billing.plan.schema';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { generateId } from 'src/utils';
import { ChargeCheck, escapeHtml } from 'src/utils/paystack';
import {
  newSubscriptionInvoice,
  paidPeriod,
  renewalInvoice,
} from 'src/utils/subscription-invoice';
import { literalPattern } from 'src/utils/transaction-query';
import { BillingNoticeService } from './billing-notice.service';
import { InvoiceNumberService } from './invoice-number.service';
import { PaystackService } from './paystack.service';

/// An invoice as the app sees it: with the checkout to open while a payment
/// is under way, and the address that means Paystack is done.
export type InvoiceView = Invoice & {
  checkoutUrl: string | null;
  callbackUrl: string;
};

const OPEN = [PaymentStatus.Pending, PaymentStatus.Processing];
const PAYABLE = [...OPEN, PaymentStatus.Failed];
/// A cancelled invoice is never offered again, but a checkout already
/// started for it still counts if the money arrives.
const SETTLEABLE = [...PAYABLE, PaymentStatus.Cancelled];

/// How long a started checkout is offered again instead of a new one.
const REUSE_CHECKOUT_MS = 30 * 60 * 1000;

/// How long an unfinished payment is re-checked with Paystack.
const RECHECK_FOR_MS = 2 * 24 * 60 * 60 * 1000;

/// Paying a subscription's invoice through Paystack, as EfieFix does: the app
/// opens the checkout, then asks the API to confirm. An invoice is paid only
/// once Paystack's verify says so, whether the app's confirm, the webhook,
/// the redirect or the re-check asks first, and only the first of those
/// settles it. Paying it is what switches the user to its plan.
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    private readonly paystackService: PaystackService,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    private readonly invoiceNumbers: InvoiceNumberService,
    private readonly notices: BillingNoticeService,
  ) {}

  static view(invoice: Invoice): InvoiceView {
    return {
      ...invoice,
      checkoutUrl:
        invoice.status === PaymentStatus.Processing
          ? (invoice.authorizationUrl ?? null)
          : null,
      callbackUrl: configuration().paystackConfig.callbackUrl,
    };
  }

  static message(invoice: Invoice): string {
    switch (invoice.status) {
      case PaymentStatus.Completed:
        return 'Payment received. Your plan is active.';
      case PaymentStatus.Failed:
        return invoice.failureReason ?? 'The payment did not go through';
      default:
        return 'Waiting for the payment';
    }
  }

  async createForSubscription(
    subscription: Subscription,
    plan: BillingPlan,
  ): Promise<Invoice> {
    const doc = await this.invoiceModel.create(
      newSubscriptionInvoice(subscription, plan, await this.invoiceNumbers.next()),
    );
    return doc.toObject();
  }

  /// The invoice for [subscription]'s next period; the user is told it's due.
  async createRenewal(
    subscription: Subscription,
    plan: BillingPlan,
  ): Promise<Invoice> {
    const doc = await this.invoiceModel.create(
      renewalInvoice(subscription, plan, await this.invoiceNumbers.next()),
    );
    const invoice = doc.toObject();
    await this.notices.renewalDue(invoice);
    return invoice;
  }

  /// Takes the unpaid invoices of [subscriptionIds] off the user's list,
  /// once a newer choice replaces them or their plan has ended.
  async cancelUnpaid(subscriptionIds: string[]): Promise<void> {
    if (!subscriptionIds.length) return;
    await this.invoiceModel.updateMany(
      { subscriptionId: { $in: subscriptionIds }, status: { $in: PAYABLE } },
      { status: PaymentStatus.Cancelled, updatedAt: new Date() },
    );
  }

  /// Starts (or reopens) Paystack's checkout for one of [user]'s invoices.
  async payInvoiceAsync(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<InvoiceView>> {
    try {
      let invoice = await this.mine(id, user.id);
      if (!invoice) return CommonResponses.NotFoundResponse('Invoice not found');
      if (invoice.status === PaymentStatus.Processing) {
        invoice = await this.check(invoice);
        const started = invoice.paymentStartedAt?.getTime() ?? 0;
        if (
          invoice.status === PaymentStatus.Processing &&
          invoice.authorizationUrl &&
          Date.now() - started < REUSE_CHECKOUT_MS
        ) {
          return CommonResponses.OkResponse(
            InvoiceService.view(invoice),
            'Finish paying on Paystack',
          );
        }
      }
      if (invoice.status === PaymentStatus.Completed) {
        return CommonResponses.ConflictResponse('This invoice is already paid');
      }
      if (invoice.status === PaymentStatus.Refunded) {
        return CommonResponses.ConflictResponse('This invoice was refunded');
      }
      if (invoice.status === PaymentStatus.Cancelled) {
        return CommonResponses.ConflictResponse(
          'This invoice was replaced. Choose a plan again to pay.',
        );
      }

      const reference = generateId();
      let checkoutUrl: string;
      try {
        ({ checkoutUrl } = await this.paystackService.createCharge({
          amount: invoice.amount,
          reference,
          email: InvoiceService.emailFor(user),
          metadata: {
            invoiceId: invoice.id,
            subscriptionId: invoice.subscriptionId,
          },
        }));
      } catch (error) {
        return CommonResponses.BadGatewayResponse(
          "Couldn't reach Paystack. Please try again.",
        );
      }

      const now = new Date();
      const updated = await this.invoiceModel
        .findOneAndUpdate(
          {
            id,
            status: { $in: PAYABLE },
          },
          {
            $set: {
              authorizationUrl: checkoutUrl,
              status: PaymentStatus.Processing,
              paymentReference: reference,
              paymentStartedAt: now,
              failureReason: null,
              updatedAt: now,
            },
            $push: { paymentReferences: reference },
          },
          { new: true },
        )
        .lean();
      if (!updated) {
        return CommonResponses.ConflictResponse('This invoice is already paid');
      }
      return CommonResponses.OkResponse(
        InvoiceService.view(updated),
        'Finish paying on Paystack',
      );
    } catch (error) {
      this.logger.error('Error paying invoice', { id }, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error paying invoice',
      );
    }
  }

  /// After the checkout closes: asks Paystack how the payment ended.
  async confirmInvoice(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<InvoiceView>> {
    try {
      const invoice = await this.mine(id, user.id);
      if (!invoice) return CommonResponses.NotFoundResponse('Invoice not found');
      const result = await this.check(invoice);
      return CommonResponses.OkResponse(
        InvoiceService.view(result),
        InvoiceService.message(result),
      );
    } catch (error) {
      this.logger.error('Error confirming invoice', { id }, error);
      return CommonResponses.InternalServerErrorResponse();
    }
  }

  /// A payment named by Paystack (webhook or redirect): settles its invoice
  /// once Paystack confirms. Null when no invoice has that reference.
  async confirmReference(reference: string): Promise<Invoice | null> {
    if (typeof reference !== 'string' || !reference) return null;
    const invoice = await this.invoiceModel
      .findOne({
        $or: [
          { paymentReferences: reference },
          { paymentReference: reference },
        ],
      })
      .lean();
    if (!invoice) return null;
    return this.check(invoice, reference);
  }

  /// An admin's "ask Paystack again" for one invoice: settles it if the
  /// payment has gone through (or failed) since.
  async recheck(id: string): Promise<Invoice | null> {
    const invoice = await this.invoiceModel.findOne({ id }).lean();
    if (!invoice) return null;
    return this.check(invoice);
  }

  /// Payments left unfinished (the app closed, a webhook missed): asked
  /// again while they may still go through.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async recheckOpenPayments(): Promise<void> {
    try {
      const open = await this.invoiceModel
        .find({
          status: { $in: [PaymentStatus.Processing, PaymentStatus.Cancelled] },
          paymentReference: { $ne: null },
          paymentStartedAt: { $gte: new Date(Date.now() - RECHECK_FOR_MS) },
        })
        .limit(200)
        .lean();
      for (const invoice of open) await this.check(invoice);
    } catch (error) {
      this.logger.error('Error re-checking open payments', error);
    }
  }

  /// Paystack's redirect when the checkout is done. The app closes the
  /// checkout before this loads; it serves a checkout finished in a browser,
  /// and older app versions, which open the payment-* links.
  async handlePaymentCallback(reference: string): Promise<string> {
    let invoice: Invoice | null = null;
    try {
      invoice = await this.confirmReference(reference);
    } catch (error) {
      this.logger.error('Error handling payment callback', { reference }, error);
    }
    const paid = invoice?.status === PaymentStatus.Completed;
    const failed = invoice?.status === PaymentStatus.Failed;
    const link = `iemontrac://${paid ? 'payment-success' : 'payment-failed'}?reference=${encodeURIComponent(reference ?? '')}&invoiceId=${encodeURIComponent(invoice?.id ?? '')}`;
    const title = paid
      ? 'Payment received'
      : failed
        ? 'Payment not completed'
        : 'Payment being confirmed';
    const body = paid
      ? 'Your plan is active. You can go back to the app.'
      : failed
        ? escapeHtml(invoice.failureReason ?? 'The payment did not go through.')
        : "We're waiting for Paystack to confirm it. You can go back to the app.";
    const href = escapeHtml(link);
    const redirect = paid || failed ? `<meta http-equiv="refresh" content="0;url=${href}">` : '';
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">${redirect}<title>IE Tracker</title><body style="font-family:system-ui;text-align:center;padding:48px 16px"><h1 style="font-size:20px">${title}</h1><p>${body}</p><p><a href="${href}">Open the app</a></p></body>`;
  }

  /// [invoice] after asking Paystack about [reference] (its latest by
  /// default), settled if the payment finished.
  private async check(
    invoice: Invoice,
    reference = invoice.paymentReference,
  ): Promise<Invoice> {
    if (!SETTLEABLE.includes(invoice.status) || !reference) return invoice;
    const check = await this.paystackService.checkCharge(
      reference,
      invoice.amount,
    );
    if (check.status === PaymentStatus.Processing) return invoice;
    // A failed invoice can still be paid, through an earlier checkout.
    if (
      (invoice.status === PaymentStatus.Failed ||
        invoice.status === PaymentStatus.Cancelled) &&
      check.status !== PaymentStatus.Completed
    ) {
      return invoice;
    }
    // An older attempt failing says nothing about the one under way.
    if (
      check.status === PaymentStatus.Failed &&
      reference !== invoice.paymentReference
    ) {
      return invoice;
    }
    return (await this.settle(invoice, check)) ?? invoice;
  }

  /// Records how the payment ended; only the first settle of an invoice
  /// wins. A paid invoice switches the user to its subscription.
  private async settle(
    invoice: Invoice,
    check: ChargeCheck,
  ): Promise<Invoice | null> {
    const now = new Date();
    if (check.status === PaymentStatus.Failed) {
      const failed = await this.invoiceModel
        .findOneAndUpdate(
          { id: invoice.id, status: { $in: OPEN } },
          {
            status: PaymentStatus.Failed,
            failureReason: check.failureReason ?? null,
            gateway: check.gateway ?? null,
            updatedAt: now,
          },
          { new: true },
        )
        .lean();
      return failed ?? this.invoiceModel.findOne({ id: invoice.id }).lean();
    }

    const subscription = await this.subscriptionModel
      .findOne({ id: invoice.subscriptionId })
      .lean();
    const paidAt = check.gateway?.paidAt ?? now;
    // A renewal paid while its plan runs carries the plan on from its end
    // date, so paying early or in the grace days loses nothing. Any other
    // payment starts its plan when it's made.
    const renewing =
      invoice.kind === InvoiceKind.Renewal &&
      subscription?.isActive &&
      subscription.status === SubscriptionStatus.Active;
    const period = renewing
      ? { startDate: invoice.startDate, endDate: invoice.endDate }
      : paidPeriod(subscription?.billingFrequency, paidAt);
    const paid = await this.invoiceModel
      .findOneAndUpdate(
        { id: invoice.id, status: { $in: SETTLEABLE } },
        {
          status: PaymentStatus.Completed,
          datePaid: paidAt,
          paymentMethod: check.method ?? null,
          gateway: check.gateway ?? null,
          failureReason: null,
          startDate: period.startDate,
          endDate: period.endDate,
          updatedAt: now,
        },
        { new: true },
      )
      .lean();
    if (!paid) return this.invoiceModel.findOne({ id: invoice.id }).lean();

    if (renewing) {
      await this.subscriptionModel.updateOne(
        { id: subscription.id },
        { endDate: period.endDate, updatedAt: now },
      );
    } else if (subscription) {
      await this.subscriptionModel.updateOne(
        { id: subscription.id },
        {
          isActive: true,
          status: SubscriptionStatus.Active,
          startDate: period.startDate,
          endDate: period.endDate,
          updatedAt: now,
        },
      );
      const others = await this.subscriptionModel
        .find({ userId: paid.userId, id: { $ne: subscription.id }, isActive: true })
        .lean();
      await this.subscriptionModel.updateMany(
        { userId: paid.userId, id: { $ne: subscription.id }, isActive: true },
        { isActive: false, status: SubscriptionStatus.Closed, updatedAt: now },
      );
      // The plan being left needs no renewal now.
      await this.cancelUnpaid(others.map((o) => o.id));
    }
    this.logger.log('Invoice paid', { invoiceId: paid.id, userId: paid.userId });
    await this.notices.paid(paid);
    return paid;
  }

  private mine(id: string, userId: string): Promise<Invoice | null> {
    return this.invoiceModel.findOne({ id, userId }).lean();
  }

  /// Paystack needs an email; a user without one gets a stand-in.
  static emailFor(user: Pick<UserJwtDetails, 'id' | 'email'>): string {
    return user.email?.includes('@')
      ? user.email
      : `${user.id}@${configuration().paystackConfig.emailDomain}`;
  }

  async getClientInvoices(
    filter: BaseFilter,
    userId: string,
  ): Promise<ApiResponseDto<PagedResults<InvoiceView>>> {
    try {
      const { page, pageSize } = filter;
      const query = { userId };
      const totalCount = await this.invoiceModel.countDocuments(query);
      const invoices = await this.invoiceModel
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .lean();
      return CommonResponses.OkResponse(
        {
          results: invoices.map(InvoiceService.view),
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
        },
        'Invoices fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error fetching client invoices', error);
      return CommonResponses.InternalServerErrorResponse(
        'Error fetching client invoices',
      );
    }
  }

  async getInvoiceById(
    id: string,
    user: UserJwtDetails,
  ): Promise<ApiResponseDto<InvoiceView>> {
    try {
      const invoice = await this.mine(id, user.id);
      if (!invoice) {
        return CommonResponses.NotFoundResponse('Invoice not found');
      }
      return CommonResponses.OkResponse(
        InvoiceService.view(invoice),
        'Invoice fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error fetching invoice by id', { id }, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error fetching invoice by id',
      );
    }
  }

  /// Everyone's invoices: admins only.
  async filterInvoices(
    filter: InvoiceFilter,
  ): Promise<ApiResponseDto<PagedResults<Invoice>>> {
    try {
      const { page, pageSize } = filter;
      const query: any = {};
      if (typeof filter.query === 'string' && filter.query) {
        query.$or = [
          { invoiceNumber: literalPattern(filter.query) },
          { description: literalPattern(filter.query) },
        ];
      }
      if (typeof filter.userId === 'string' && filter.userId) {
        query.userId = filter.userId;
      }
      const totalCount = await this.invoiceModel.countDocuments(query);
      const invoices = await this.invoiceModel
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .lean();
      return CommonResponses.OkResponse(
        {
          results: invoices,
          totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
        },
        'Invoices fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error filtering invoices', filter, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error filtering invoices',
      );
    }
  }
}
