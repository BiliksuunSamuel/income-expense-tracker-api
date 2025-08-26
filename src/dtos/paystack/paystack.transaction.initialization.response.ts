export class PaystackTransactionInitializationResponse {
  status: boolean;
  messag: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}
