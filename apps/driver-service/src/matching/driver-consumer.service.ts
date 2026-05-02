import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import {
  DriverStatus,
  TripMatchingRequest,
  TripResponseDto,
} from '@repo/shared';
import type { ChannelWrapper } from 'amqp-connection-manager';
import * as amqp from 'amqplib';
import { MatchingService } from './matching.service';
import { DriverService } from 'src/driver/driver.service';

@Injectable()
export class DriverConsumer implements OnModuleInit {
  private readonly logger = new Logger(DriverConsumer.name);

  constructor(
    @Inject('RABBITMQ_CHANNEL') private readonly channel: ChannelWrapper,
    private readonly matchingService: MatchingService,
    private readonly driverService: DriverService,
  ) {}

  async onModuleInit() {
    await this.channel.addSetup(async (ch: amqp.Channel) => {
      await ch.consume('trip.events_queue', (msg) => {
        if (!msg) return;
        const routingKey = msg.fields.routingKey;

        try {
          if (routingKey === 'trip.requested') {
            const content = JSON.parse(
              msg.content.toString(),
            ) as TripMatchingRequest;
            this.matchingService.handleTripRequested(content);
          }

          if (routingKey === 'trip.cancel') {
            const content = JSON.parse(
              msg.content.toString(),
            ) as TripMatchingRequest;
            this.matchingService.handleTripCancelled(content.id);
          }

          if (routingKey === 'trip.completed') {
            const raw = msg.content.toString();

            let driverId: string;

            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === 'string') driverId = parsed;
              else driverId = raw; // fallback
            } catch {
              driverId = raw;
            }

            this.driverService.updateStatus(driverId, DriverStatus.ONLINE);
          }
        } catch (err) {
          console.error('Error handling message:', routingKey, err);
        }

        ch.ack(msg);
      });
    });
  }
}
