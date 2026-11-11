import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { InvoiceFilter } from 'src/dtos/invoices/invoice-filter.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AdminGuard } from 'src/providers/admin.guard';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { Invoice } from 'src/schemas/invoice.schema';
import { InvoiceService } from 'src/services/invoice.service';

@Controller('api/invoices')
@ApiTags('Invoices')
export class InvoicesController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getInvoices(@Query() filter: InvoiceFilter, @Res() response: Response) {
    const res = await this.invoiceService.filterInvoices(filter);
    response.status(res.code).send(res);
  }

  /// Paystack's checkout redirect (the callback URL). Public: it only asks
  /// Paystack how the payment went.
  @Get('update-status')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async handlePaymentCallback(
    @Query('reference') reference: string,
    @Res() response: Response,
  ) {
    const html = await this.invoiceService.handlePaymentCallback(reference);
    response.status(200).send(html);
  }

  /// Starts Paystack's checkout; the invoice comes back with `checkoutUrl`.
  @Post('pay/:id')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  async payInvoice(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.invoiceService.payInvoiceAsync(id, user);
    response.status(res.code).send(res);
  }

  /// After the checkout closes: how the payment ended.
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  async confirmInvoice(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.invoiceService.confirmInvoice(id, user);
    response.status(res.code).send(res);
  }

  @Get('client')
  @UseGuards(JwtAuthGuard)
  async getClientInvoices(
    @Query() filter: InvoiceFilter,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.invoiceService.getClientInvoices(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('/:invoiceId')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ type: Invoice })
  @ApiParam({ name: 'invoiceId', type: String })
  async getInvoiceById(
    @Param('invoiceId') invoiceId: string,
    @Res() response: Response,
    @AuthUser() user: UserJwtDetails,
  ) {
    const res = await this.invoiceService.getInvoiceById(invoiceId, user);
    response.status(res.code).send(res);
  }
}
