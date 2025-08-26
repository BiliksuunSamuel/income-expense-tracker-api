import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponseDto } from 'src/common/api.response.dto';
import { BaseFilter } from 'src/common/base.filter.dto';
import { PagedResults } from 'src/common/paged.results.dto';
import { InvoiceFilter } from 'src/dtos/invoices/invoice-filter.dto';
import { PaymentStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { Invoice } from 'src/schemas/invoice.schema';
import { generateId } from 'src/utils';
import { PaystackService } from './paystack.service';
import { Subscription } from 'src/schemas/subscription.schema';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    private readonly paystackService: PaystackService,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
  ) {}

  // do handle invoice payment callback
  async handlePaymentCallback(reference: string): Promise<any> {
    try {
      this.logger.log(
        'Received callbck to handle payment for invoice',
        reference,
      );
      const invoice = await this.invoiceModel
        .findOne({ paymentReference: reference })
        .lean();
      if (!invoice) {
        return `
          <!DOCTYPE html>
          <html>
            <head>
                <title>Redirecting...</title>
                <script>
                window.onload = function() {
                    window.location.href = "iemontrac://payment-failed?reference=${reference}&invoiceId=not-found";
                };
                </script>
                <head>
            <body>
                <p>Redirecting to app... <br>
                <a href="iemontrac://payment-failed?reference=${reference}&invoiceId=not-found">Click here if not redirected</a>
                </p>
            </body> 
                </html>
        `;
      }
      await this.invoiceModel.findOneAndUpdate(
        { id: invoice.id },
        {
          status: PaymentStatus.Completed,
          datePaid: new Date(),
          updatedAt: new Date(),
          updatedBy: invoice.createdBy,
        },
      );

      //Mark subscription as active
      await this.subscriptionModel
        .findOneAndUpdate(
          { id: invoice.subscriptionId },
          {
            isActive: true,
            status: 'active',
          },
          { new: true },
        )
        .lean();
      this.logger.log('Handling payment callback for invoice', {
        reference,
        invoiceId: invoice.id,
      });
      return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Redirecting...</title>
            <script>
            window.onload = function() {
                window.location.href = "iemontrac://payment-success?reference=${invoice.paymentReference}&invoiceId=${invoice.id}";
            };
            </script>
        </head>
        <body>
            <p>Redirecting to app... <br>
            <a href="iemontrac://payment-success?reference=${invoice.paymentReference}&invoiceId=${invoice.id}">Click here if not redirected</a>
            </p>
        </body>
        </html>
      `;
    } catch (error) {
      this.logger.error(
        'Error handling payment callback',
        { reference },
        error,
      );
      //return html alert of an error
      return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting...</title>
                <script>
                window.onload = function() {
                    window.location.href = "iemontrac://payment-failed?reference=abc123&projectId=xyz456";
                };
                </script>
            </head>
            <body>
                <p>Redirecting to app... <br>
                <a href="iemontrac://payment-failed?reference=abc123&projectId=xyz456">Click here if not redirected</a>
                </p>
            </body>
            </html>
        `;
    }
  }

  // Do pay invoice
  async payInvoiceAsync(id: string): Promise<ApiResponseDto<Invoice>> {
    try {
      const invoice = await this.invoiceModel.findOne({ id }).lean();
      if (!invoice) {
        return CommonResponses.NotFoundResponse('Invoice not found');
      }
      if (
        invoice.status !== PaymentStatus.Pending &&
        invoice.status !== PaymentStatus.Processing
      ) {
        return CommonResponses.ForbiddenResponse('Invoice already processed');
      }
      const paymentReference = generateId();
      invoice.paymentReference = paymentReference;

      const res = await this.paystackService.initiateTransaction(invoice);

      if (!res) {
        return CommonResponses.FaildedDependencyResponse(
          'Failed to initiate payment',
        );
      }

      const updatedInvoice = await this.invoiceModel
        .findOneAndUpdate(
          { id },
          {
            authorizationUrl: res.data.authorization_url,
            status: PaymentStatus.Processing,
            paymentReference: invoice.paymentReference,
          },
          { new: true },
        )
        .lean();

      if (!updatedInvoice) {
        return CommonResponses.NotFoundResponse('Invoice not found');
      }
      return CommonResponses.OkResponse(
        updatedInvoice,
        'Payment initiated successfully. Please complete the payment on Paystack.',
      );
    } catch (error) {
      this.logger.error('Error paying invoice', { id }, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error paying invoice',
      );
    }
  }

  //Get client invoices
  async getClientInvoices(
    filter: BaseFilter,
    userId: string,
  ): Promise<ApiResponseDto<PagedResults<Invoice>>> {
    try {
      const { page, pageSize } = filter;
      const query = { userId };
      const totalCount = await this.invoiceModel.countDocuments(query);
      const invoices = await this.invoiceModel
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .lean();
      const pagedResults: PagedResults<Invoice> = {
        results: invoices,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
      return CommonResponses.OkResponse(
        pagedResults,
        'Invoices fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error fetching client invoices', error);
      return CommonResponses.InternalServerErrorResponse(
        'Error fetching client invoices',
      );
    }
  }

  //Get invoice by id
  async getInvoiceById(id: string): Promise<ApiResponseDto<Invoice>> {
    try {
      const invoice = await this.invoiceModel.findOne({ id }).lean();
      if (!invoice) {
        return CommonResponses.NotFoundResponse('Invoice not found');
      }
      return CommonResponses.OkResponse(
        invoice,
        'Invoice fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error fetching invoice by id', { id }, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error fetching invoice by id',
      );
    }
  }

  //filter invoices
  async filterInvoices(
    filter: InvoiceFilter,
  ): Promise<ApiResponseDto<PagedResults<Invoice>>> {
    try {
      const { page, pageSize } = filter;
      const query: any = {};
      if (filter.query) {
        query.title = { $regex: filter.query, $options: 'i' };
      }
      if (filter.userId) {
        query.userId = filter.userId;
      }
      const totalCount = await this.invoiceModel.countDocuments(query);
      const invoices = await this.invoiceModel
        .find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .lean();

      const response: PagedResults<Invoice> = {
        results: invoices,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };

      return CommonResponses.OkResponse(
        response,
        'Invoices fetched successfully',
      );
    } catch (error) {
      this.logger.error('Error filtering invoices', filter, error);
      return CommonResponses.InternalServerErrorResponse(
        'Error filtering invoices',
      );
    }
  }
}
