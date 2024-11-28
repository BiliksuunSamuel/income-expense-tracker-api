import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import configuration from 'src/configuration';
import { EmailRequest } from 'src/dtos/notification/email.request.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: configuration().emailUsername,
        pass: configuration().emailPassword,
      },
    });
  }

  //send email
  async sendEmail(request: EmailRequest): Promise<void> {
    try {
      this.logger.debug('sending email', request);
      var res = await this.transporter.sendMail({
        from: 'bhills7704@gmail.com',
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
      });
      this.logger.debug('response from sending email', res);
    } catch (error) {
      this.logger.error(
        'an error occurred while sending emali',
        request,
        error,
      );
    }
  }
}
