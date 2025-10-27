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
            for (const ex of options.exchanges) {
              // 1️⃣ Đảm bảo exchange tồn tại
              await ch.assertExchange(ex.name, ex.type, {
                durable: true,
                arguments: { 'x-dead-letter-exchange': 'dlx' },
              });

              // 2️⃣ (Tuỳ chọn) tạo queue mặc định để không bị treo khi chưa có consumer
              const queueName = `${ex.name}_queue`;
              await ch.assertQueue(queueName, {
                durable: true,
                arguments: { 'x-dead-letter-exchange': 'dlx' },
              });

              // 3️⃣ Bind queue mặc định với tất cả routing key
              await ch.bindQueue(queueName, ex.name, '#');

              console.log(`[RabbitMQ] Bound ${queueName} → ${ex.name}`);
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
