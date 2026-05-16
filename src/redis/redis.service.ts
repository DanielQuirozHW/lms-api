import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

interface RedisConfig {
  host: string | undefined;
  port: number | undefined;
  password: string | undefined;
}

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: RedisConfig) {
    super({
      host: config.host ?? 'localhost',
      port: config.port ?? 6379,
      password: config.password || undefined,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.on('connect', () => {
      this.logger.log('Redis connected');
    });
    this.on('error', (err: Error) => {
      this.logger.error('Redis error', err.message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
