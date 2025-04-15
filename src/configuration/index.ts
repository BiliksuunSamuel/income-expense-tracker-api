import * as dotenv from 'dotenv';

dotenv.config();

export default () => ({
  port: parseInt(process.env.PORT, 0) || parseInt(process.env.Port, 0),
  dbConnectionString: process.env.DbConnectionString,
  jwtScret: process.env.JwtSecret,
  senderId: process.env.SenderId,
  smsApi: process.env.SmsApi,
  smsKey: process.env.SmsKey,
  apiKey: process.env.ApiKey,
  apiSecret: process.env.ApiSecret,
  cloudName: process.env.CloudName,
  emailPassword: process.env.EmailPassword,
  emailUsername: process.env.EmailUserName,
  googleAuthUrl: process.env.GoogleAuthUrl,
  firebaseProjectId: process.env.FirebaseProjectId,
  firebasePrivateKey: process.env.FirebasePrivateKey?.replace(/\\n/g, '\n'),
  firebaseClientEmail: process.env.FirebaseClientEmail,
});
