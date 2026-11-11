import { Injectable, Logger } from '@nestjs/common';
import { spawnStateless } from 'nact';
import { BaseActor } from './base.actor';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import { ProxyHttpService } from 'src/services/proxy-http.service';
import { FirebaseService } from 'src/services/firebase.service';
import { SendSmsRequest } from 'src/common';
import { MailService } from 'src/services/mail.service';
import { EmailRequest } from 'src/dtos/notification/email.request.dto';
import { SmsNotificationDto } from 'src/dtos/notification/sms-notification.dto';
import configuration from 'src/configuration';

interface SmsProviderResponse {
  success?: boolean;
  status?: number;
  message?: string;
}

@Injectable()
export class NotificationsActor extends BaseActor {
  private readonly logger = new Logger(NotificationsActor.name);

  constructor(
    private readonly proxyHttpService: ProxyHttpService,
    private readonly firebaseService: FirebaseService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  //handle sending fcm notification
  sendFcmNotication = spawnStateless(
    this.system,
    async (msg: FcmNotificationRequest, ctx) => {
      try {
        this.logger.debug(
          'received message to send fcm notification',
          msg,
          ctx.name,
        );
        await this.firebaseService.sendNotification(msg);
      } catch (error) {
        this.logger.error(
          'an error occurred while sending fcm notification',
          msg,
          ctx.name,
          error,
        );
      }
    },
  );
  //handle sending a generic email notification
  emailNotificationActor = spawnStateless(
    this.system,
    async (msg: EmailRequest, ctx) => {
      try {
        this.logger.debug('received message to send email notification', msg);
        await this.mailService.sendEmail(msg);
      } catch (error) {
        this.logger.error(
          'an error occurred while sending email notification',
          msg,
          ctx.name,
          error,
        );
      }
    },
  );

  /// Sends an SMS through LetsFish, as Pulse does. Used for admin sign-in
  /// codes; app users' codes still go by email (smsNotificationActor).
  sendSmsNotification = spawnStateless(
    this.system,
    async (msg: SmsNotificationDto) => {
      try {
        const { smsApi, token, senderId } = configuration().sms;
        const res = await this.proxyHttpService.request<SmsProviderResponse>({
          method: 'post',
          url: `${smsApi}/v1/sms`,
          token,
          data: {
            message: msg.message,
            recipients: msg.recipients,
            sender_id: senderId,
          },
        });
        if (res?.success === false) {
          this.logger.error('SMS provider rejected the message', res);
          return;
        }
        this.logger.log('SMS sent');
      } catch (error) {
        this.logger.error('Error sending SMS', error?.message ?? error);
      }
    },
  );

  //handle sending sms notification
  smsNotificationActor = spawnStateless(
    this.system,
    async (msg: SendSmsRequest, ctx) => {
      try {
        this.logger.debug('sending sms notification', msg, ctx.name);
        await this.mailService.sendEmail({
          to: msg.to,
          text: msg.message,
          html: '',
          subject: 'Verification Code',
        });
      } catch (error) {
        this.logger.error(
          'an error occurred while sending sms notification',
          error,
          msg,
          ctx.name,
        );
      }
    },
  );
}
