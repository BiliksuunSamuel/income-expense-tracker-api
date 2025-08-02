import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';
import configuration from 'src/configuration';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor() {

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: configuration().firebaseProjectId,
          privateKey: configuration().firebasePrivateKey,
          clientEmail:configuration().firebaseClientEmail,
        }),
      });
      this.logger.log('Firebase app initialized');
    } else {
      this.logger.log('Firebase app already initialized');
    }
  }

  async sendNotification(message: FcmNotificationRequest) {
    try {
      const response = await admin.messaging().send(message);
      this.logger.debug('notification sent', message, response);
    } catch (error) {
      this.logger.error('an error occurred while sending notification', error);
    }
  }
}
