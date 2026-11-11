import { Injectable, Logger } from '@nestjs/common';
import configuration from 'src/configuration';
import { PaymentStatus } from 'src/enums';
import {
  ChargeCheck,
  PaystackTransaction,
  paystackAmount,
  toChargeCheck,
} from 'src/utils/paystack';
import { ProxyHttpService } from './proxy-http.service';

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

/// Paystack's hosted checkout, as in EfieFix: the user picks MoMo or card
/// on Paystack's page, and a charge only counts once Paystack's verify says
/// so, never from a redirect or a webhook body alone.
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  constructor(private readonly proxyHttpService: ProxyHttpService) {}

  private get config() {
    return configuration().paystackConfig;
  }

  /// Starts a checkout for [amount] cedis under [reference].
  async createCharge(input: {
    amount: number;
    reference: string;
    email: string;
    metadata?: Record<string, string>;
  }): Promise<{ reference: string; checkoutUrl: string }> {
    const res = await this.proxyHttpService.request<
      PaystackResponse<{ authorization_url: string; reference: string }>
    >({
      method: 'post',
      url: `${this.config.url}/transaction/initialize`,
      token: this.config.secretKey,
      data: {
        email: input.email,
        amount: paystackAmount(input.amount),
        currency: this.config.currency,
        reference: input.reference,
        callback_url: this.config.callbackUrl,
        channels: ['mobile_money', 'card'],
        metadata: input.metadata,
      },
    });
    return {
      reference: res.data.reference,
      checkoutUrl: res.data.authorization_url,
    };
  }

  /// How the charge under [reference] ended; [amount] (cedis) must match what
  /// was paid. Processing if Paystack can't be reached.
  async checkCharge(reference: string, amount: number): Promise<ChargeCheck> {
    try {
      const res = await this.proxyHttpService.request<
        PaystackResponse<PaystackTransaction>
      >({
        method: 'get',
        url: `${this.config.url}/transaction/verify/${encodeURIComponent(reference)}`,
        token: this.config.secretKey,
      });
      return toChargeCheck(res.data, paystackAmount(amount));
    } catch (error) {
      this.logger.warn(`couldn't verify ${reference} with Paystack`);
      return { status: PaymentStatus.Processing };
    }
  }
}
