import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { AppConfig } from './config/configuration';
import helmet from 'helmet';

const BODY_SIZE_LIMIT = '10mb';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

  const config = app.get(ConfigService<AppConfig>);

  app.use(helmet());

  const corsOrigins = config.get('cors.origins', { infer: true }) ?? ['http://localhost:3001'];
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const apiPrefix = config.get('apiPrefix', { infer: true }) ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true }) ?? 3000;
  const env = config.get('nodeEnv', { infer: true }) ?? 'development';

  await app.listen(port);
  logger.log(`Application running on port ${String(port)} [${env}]`);
}

void bootstrap();
