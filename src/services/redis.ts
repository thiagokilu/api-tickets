import {
  Global,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

@Global()
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;

  constructor() {
    this.redis = this.createClient();
  }

  private createClient(): Redis {
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: () => null,
    };

    if (process.env.REDIS_URL) {
      const client = new Redis(process.env.REDIS_URL, options);
      this.registerErrorHandler(client);
      return client;
    }

    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      ...options,
    });
    this.registerErrorHandler(client);
    return client;
  }

  private registerErrorHandler(client: Redis): void {
    client.on('error', () => {});
  }

  async onModuleInit(): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.redis.connect();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Redis connection attempt ${attempt}/3 failed: ${lastError.message}`,
        );
        this.redis.disconnect();

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          this.redis = this.createClient();
        }
      }
    }

    throw new Error(
      `Redis unavailable after 3 connection attempts: ${lastError?.message}`,
    );
  }

  get client(): Redis {
    return this.redis;
  }

  onModuleDestroy(): void {
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }
}
