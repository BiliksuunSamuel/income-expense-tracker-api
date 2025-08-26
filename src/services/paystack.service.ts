import { Injectable, Logger, Post } from '@nestjs/common';
import { ProxyHttpService } from './proxy-http.service';
import configuration from 'src/configuration';
import { PaystackTransactionInitializationResponse } from 'src/dtos/paystack/paystack.transaction.initialization.response';
import { Invoice } from 'src/schemas/invoice.schema';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  constructor(private readonly proxyHttpService: ProxyHttpService) {}

  //initiate transaction
  async initiateTransaction(
    transaction: Invoice,
  ): Promise<PaystackTransactionInitializationResponse> {
    try {
      const url = `${configuration().paystackConfig.url}/transaction/initialize`;

      const res =
        await this.proxyHttpService.request<PaystackTransactionInitializationResponse>(
          {
            method: 'post',
            url: url,
            token: configuration().paystackConfig.secretKey,
            data: {
              email: transaction.createdBy,
              reference: transaction.paymentReference,
              amount: transaction.amount,
              callback_url: `${configuration().baseUrl}/api/invoices/update-status?trxRef=${transaction.paymentReference}`,
              metadata:
                transaction.subscriptionId &&
                transaction.subscriptionId.length > 0
                  ? {
                      subscriptionId:
                        transaction.subscriptionId ?? transaction.id,
                      invoiceId: transaction.id,
                    }
                  : {
                      InvoiceId: transaction.id,
                    },
            },
          },
        );
      this.logger.debug('response from paystack', res);
      return res;
    } catch (error) {
      this.logger.error(
        'An error occurred while initiating transaction',
        transaction,
        error,
      );
      return null;
    }
  }
}
