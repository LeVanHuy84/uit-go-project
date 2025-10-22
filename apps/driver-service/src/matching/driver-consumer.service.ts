import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { TripMatchingRequest, TripResponseDto } from '@repo/shared';
import type { ChannelWrapper } from 'amqp-connection-manager';
import * as amqp from 'amqplib';
import { MatchingService } from './matching.service';

@Injectable()
export class DriverConsumer implements OnModuleInit {
  private readonly logger = new Logger(DriverConsumer.name);

  constructor(
    @Inject('RABBITMQ_CHANNEL') private readonly channel: ChannelWrapper,
    private readonly matchingService: MatchingService,
  ) {}

  async onModuleInit() {
    await this.channel.addSetup(async (ch: amqp.Channel) => {
      await ch.consume('trip.events_queue', (msg) => {
        if (!msg) return;
        const content = JSON.parse(
          msg.content.toString(),
        ) as TripMatchingRequest;
        const routingKey = msg.fields.routingKey;

        if (routingKey === 'trip.requested') {
          this.matchingService.handleTripRequested(content);
        }

        if (routingKey === 'trip.cancel') {
          this.matchingService.handleTripCancelled(content.id);
        }

        ch.ack(msg);
      });
    });
  }
}
