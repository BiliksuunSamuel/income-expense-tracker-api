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
  paystackConfig: {
    url: process.env.PaystackBaseUrl || 'https://api.paystack.co',
    /// Where Paystack's checkout goes when it's done; the app watches for
    /// this address and closes the checkout.
    callbackUrl:
      process.env.PaystackCallbackUrl ||
      `${process.env.ApiBaseUrl}/api/invoices/update-status`,
    currency: process.env.PaystackCurrency || 'GHS',
    /// Paystack's units per cedi: 100 (pesewas) in production. 1 makes a
    /// GHS 20 plan cost 20 pesewas, for trying a live key safely.
    amountMultiplier: Number(process.env.PaystackAmountMultiplier) || 100,
    /// Paystack needs an email; users without one get `<id>@` this domain.
    emailDomain: process.env.PaystackEmailDomain || 'users.ietracker.app',
    secretKey: process.env.PaystackSecretKey,
  },
  baseUrl: process.env.ApiBaseUrl,
});
