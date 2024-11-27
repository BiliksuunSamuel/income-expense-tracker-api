import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as serviceAccountConfig from '../firebase.config.json';
import { FcmNotificationRequest } from 'src/dtos/notification/fcm.notification.request.dto';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccountConfig as admin.ServiceAccount,
        ),
      });
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
