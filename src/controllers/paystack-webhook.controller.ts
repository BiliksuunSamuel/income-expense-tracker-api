import { Controller, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { InvoiceService } from 'src/services/invoice.service';
import { isValidPaystackSignature } from 'src/utils/paystack';

/// Paystack's events, as in EfieFix. Public: trust comes from the signature
/// over the raw body (kept in main.ts), and the payment is always asked
/// about again before an invoice counts as paid.
@Controller('api/payments/paystack')
@ApiExcludeController()
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('webhook')
  async handle(@Req() request: Request, @Res() response: Response) {
    const raw = (request as Request & { rawBody?: Buffer }).rawBody;
    const signature = request.headers['x-paystack-signature'];
    if (
      typeof signature !== 'string' ||
      !raw ||
      !isValidPaystackSignature(raw, signature)
    ) {
      this.logger.warn('rejected a Paystack webhook with a bad signature');
      response.status(401).send();
      return;
    }
    try {
      const body = JSON.parse(raw.toString('utf8'));
      const reference = body?.data?.reference;
      if (String(body?.event ?? '').startsWith('charge.')) {
        await this.invoiceService.confirmReference(reference);
      }
    } catch (error) {
      // 200 regardless: Paystack retries otherwise, and the app's confirm or
      // the re-check settles it.
      this.logger.error("couldn't handle a Paystack webhook", error);
    }
    response.status(200).send();
  }
}
