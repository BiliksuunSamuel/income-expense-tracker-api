import { Module } from '@nestjs/common';
import { EventGatewayService } from 'src/providers/events.gateway.service';

@Module({
  providers: [EventGatewayService],
})
export class EventsModule {}
