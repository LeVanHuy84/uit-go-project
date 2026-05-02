import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  connect,
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import * as amqp from 'amqplib';

export interface ExchangeConfig {
  name: string;
  type: 'topic' | 'direct' | 'fanout';
}

export interface RabbitmqModuleOptions {
  urls: string[];
  exchanges: ExchangeConfig[];
}

@Global()
@Module({})
export class RabbitmqModule {
  static register(options: RabbitmqModuleOptions): DynamicModule {
    const connectionProvider = {
      provide: 'RABBITMQ_CONNECTION',
      useFactory: (): AmqpConnectionManager => {
        const conn = connect(options.urls);

        conn.on('connect', () => console.log('[RabbitMQ] Connected ✅'));
        conn.on('disconnect', (err) =>
          console.error('[RabbitMQ] Disconnected ❌', err?.err?.message)
        );

        return conn;
      },
    };

    const channelProvider = {
      provide: 'RABBITMQ_CHANNEL',
      useFactory: (conn: AmqpConnectionManager): ChannelWrapper => {
        const channel = conn.createChannel({
          json: true,
          setup: async (ch: amqp.Channel) => {
            console.log('[RabbitMQ] Setting up exchanges and queues...');

            // 1️⃣ Tạo DLX exchange
            await ch.assertExchange('dlx', 'direct', { durable: true });

            for (const ex of options.exchanges) {
              // Exchange chính
              await ch.assertExchange(ex.name, ex.type, { durable: true });

              // MAIN QUEUE
              const mainQueue = `${ex.name}_queue`;
              await ch.assertQueue(mainQueue, {
                durable: true,
                arguments: {
                  'x-dead-letter-exchange': 'dlx',
                  'x-dead-letter-routing-key': `${ex.name}.retry`,
                },
              });

              await ch.bindQueue(mainQueue, ex.name, '#');

              // RETRY QUEUE
              const retryQueue = `${ex.name}.retry`;
              await ch.assertQueue(retryQueue, {
                durable: true,
                arguments: {
                  'x-message-ttl': 5000, // retry sau 5s
                  'x-dead-letter-exchange': ex.name,
                  'x-dead-letter-routing-key': '#',
                },
              });

              await ch.bindQueue(retryQueue, 'dlx', `${ex.name}.retry`);

              console.log(`[RabbitMQ] Setup retry for ${ex.name}`);
            }
          },
        });

        // Không dùng await ở đây, chỉ log khi sẵn sàng
        channel.waitForConnect().then(() => {
          console.log('[RabbitMQ] Channel ready 🟢');
        });

        return channel;
      },
      inject: ['RABBITMQ_CONNECTION'],
    };

    return {
      module: RabbitmqModule,
      providers: [connectionProvider, channelProvider],
      exports: [connectionProvider, channelProvider],
    };
  }
}
