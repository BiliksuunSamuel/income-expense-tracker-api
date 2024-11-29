import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { SendSmsRequest } from 'src/common';
import configuration from 'src/configuration';
import { HttpRequestDto } from 'src/dtos/common/http.request.dto';

@Injectable()
export class ProxyHttpService {
  private readonly logger = new Logger(ProxyHttpService.name);
  constructor(private readonly httpService: HttpService) {}

  async sendSms({ to, message }: SendSmsRequest): Promise<any> {
    try {
      const res = await this.httpService.axiosRef.post(
        configuration().smsApi,
        null,
        {
          params: {
            key: configuration().smsKey,
            sender_id: configuration().senderId,
            to,
            msg: message,
          },
        },
      );
      this.logger.debug('send sms response', res.data);
    } catch (error) {
      this.logger.error('an error occurred while sending sms', to, error);
    }
  }

  async request<T>(request: HttpRequestDto): Promise<T> {
    try {
      this.logger.debug('making http request', request);

      const res = await this.httpService.axiosRef({
        method: request.method,
        url: request.url,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${request.token}`,
        },
        params: request.params,
        data: request.data,
      });
      this.logger.debug('response from http request', res.data);
      return res.data as T;
    } catch (error) {
      this.logger.error('an error occurred while making http request', error);
      throw error;
    }
  }
}
