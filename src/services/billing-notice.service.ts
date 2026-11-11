import { Injectable, Logger } from '@nestjs/common';
import { dispatch } from 'nact';
import { NotificationsActor } from 'src/actors/notification.actor';
import { UserRepository } from 'src/repositories/user.repository';
import { Invoice } from 'src/schemas/invoice.schema';
import { Subscription } from 'src/schemas/subscription.schema';
import { escapeHtml } from 'src/utils/paystack';

const day = (d: Date) =>
  new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const money = (invoice: Invoice) =>
  `${invoice.currency ?? 'GHS'} ${invoice.amount.toFixed(2)}`;

/// Tells a user, by push and email, about their bill: a receipt, a renewal
/// due, and a plan that has ended.
@Injectable()
export class BillingNoticeService {
  private readonly logger = new Logger(BillingNoticeService.name);
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationActor: NotificationsActor,
  ) {}

  paid(invoice: Invoice) {
    return this.send(
      invoice.userId,
      'Payment received',
      `We received ${money(invoice)} for invoice ${invoice.invoiceNumber}. Your plan runs until ${day(invoice.endDate)}.`,
      { type: 'invoice_paid', invoiceId: invoice.id },
    );
  }

  renewalDue(invoice: Invoice) {
    return this.send(
      invoice.userId,
      'Your plan renews soon',
      `Invoice ${invoice.invoiceNumber} for ${money(invoice)} is due on ${day(invoice.dueDate)}. Pay it in the app to keep your plan.`,
      { type: 'invoice_due', invoiceId: invoice.id },
    );
  }

  expired(subscription: Subscription) {
    return this.send(
      subscription.userId,
      'Your plan has ended',
      `Your ${subscription.planTitle} plan ended and you are back on Regular. Your entries are all still there; renew any time from Plans.`,
      { type: 'plan_expired', subscriptionId: subscription.id },
    );
  }

  private async send(
    userId: string,
    title: string,
    message: string,
    data: Record<string, string>,
  ) {
    try {
      const user = await this.userRepository.getByIdAsync(userId);
      if (!user) return;
      if (user.fcmToken?.length > 0) {
        dispatch(this.notificationActor.sendFcmNotication, {
          token: user.fcmToken,
          notification: { title, body: message },
          data,
        });
      }
      if (user.email?.includes('@')) {
        const greeting = user.firstName
          ? `Hi ${escapeHtml(user.firstName)},`
          : 'Hi,';
        dispatch(this.notificationActor.emailNotificationActor, {
          to: user.email,
          subject: title,
          text: `${greeting} ${message}`,
          html: `<p>${greeting}</p><p>${escapeHtml(message)}</p>`,
        });
      }
    } catch (error) {
      this.logger.error('Error sending billing notice', { userId, title }, error);
    }
  }
}
