import * as admin from 'firebase-admin';

export class FcmNotificationRequest {
  token: string;
  notification: admin.messaging.Notification;
  data?: admin.messaging.DataMessagePayload;
}
