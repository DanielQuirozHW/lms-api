import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import type { AppConfig } from '../config/configuration';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (config: ConfigService<AppConfig>): RedisService => {
        return new RedisService({
          host: config.get('redis.host', { infer: true }),
          port: config.get('redis.port', { infer: true }),
          password: config.get('redis.password', { infer: true }),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
