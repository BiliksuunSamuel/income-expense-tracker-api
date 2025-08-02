import { Injectable, Logger } from '@nestjs/common';
import { spawnStateless } from 'nact';
import { BaseActor } from './base.actor';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import { ProxyHttpService } from 'src/services/proxy-http.service';
import { FirebaseService } from 'src/services/firebase.service';
import { SendSmsRequest } from 'src/common';
import { MailService } from 'src/services/mail.service';

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
