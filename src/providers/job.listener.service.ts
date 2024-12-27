import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JobListenerService {
  private readonly logger = new Logger(JobListenerService.name);
  constructor() {}
}
