export class HttpRequestDto {
  url: string;
  method: 'get' | 'post' | 'put' | 'delete';
  headers?: object;
  data?: object;
  params?: object;
  token?: string;
}
