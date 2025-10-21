import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import * as amqp from 'amqplib';
import { TripService } from '../trip.service';

@Injectable()
export class TripConsumer implements OnModuleInit {
  private readonly logger = new Logger(TripConsumer.name);

  constructor(
    @Inject('RABBITMQ_CHANNEL') private readonly channel: ChannelWrapper,
    private readonly tripService: TripService,
  ) {}

  async onModuleInit() {
    await this.channel.addSetup(async (ch: amqp.Channel) => {
      await ch.consume('driver.events_queue', (msg) => {
        if (!msg) return;
        const data = JSON.parse(msg.content.toString());
        const key = msg.fields.routingKey;

        switch (key) {
          case 'driver.timeout': {
            const { tripId } = data;
            if (!tripId) {
              this.logger.warn(
                `Invalid payload for driver.timeout: ${msg.content}`,
              );
              break;
            }
            this.logger.log(`Received driver.timeout for trip=${tripId}`);
            this.tripService.timeoutTrip(tripId);
            break;
          }

          case 'driver.accepted': {
            const { tripId, driverId } = data;
            if (!tripId || !driverId) {
              this.logger.warn(
                `Invalid payload for driver.accepted: ${msg.content}`,
              );
              break;
            }
            this.tripService.acceptTrip(tripId, driverId);
            break;
          }

          default:
            this.logger.warn(`Unhandled routing key: ${key}`);
            break;
        }

        ch.ack(msg);
      });
    });
  }
}
