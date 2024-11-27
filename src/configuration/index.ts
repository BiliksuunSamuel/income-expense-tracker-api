import * as dotenv from 'dotenv';

dotenv.config();

export default () => ({
  port: parseInt(process.env.Port, 10) || 3000,
  dbConnectionString: process.env.DbConnectionString,
  jwtScret: process.env.JwtSecret,
  senderId: process.env.SenderId,
  smsApi: process.env.SmsApi,
  smsKey: process.env.SmsKey,
  apiKey: process.env.ApiKey,
  apiSecret: process.env.ApiSecret,
  cloudName: process.env.CloudName,
});
