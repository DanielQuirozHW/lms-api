import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, type NestApplication } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createAdapter } from '@socket.io/redis-adapter';
import { json, urlencoded } from 'express';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { AppConfig } from './config/configuration';
import { RedisService } from './redis/redis.service';
import helmet from 'helmet';

class SocketIoCorsAdapter extends IoAdapter {
  constructor(
    app: NestApplication,
    private readonly origins: string[],
    private readonly ioAdapter?: ServerOptions['adapter'],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      maxHttpBufferSize: 1e6,
      cors: { origin: this.origins, credentials: true },
      ...(this.ioAdapter && { adapter: this.ioAdapter }),
    });
  }
}

const BODY_SIZE_LIMIT = '256kb';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: BODY_SIZE_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

  const config = app.get(ConfigService<AppConfig>);

  app.use(helmet());
  // helmet does not include Permissions-Policy; set it explicitly to restrict browser features
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const corsOrigins = config.get('cors.origins', { infer: true }) ?? ['http://localhost:3001'];
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  });

  // Duplicate the existing Redis connection for Socket.io pub/sub so real-time events
  // broadcast correctly across multiple server instances (horizontal scaling on Railway).
  const redisService = app.get(RedisService);
  const pubClient = redisService.duplicate();
  const subClient = redisService.duplicate();
  app.useWebSocketAdapter(
    new SocketIoCorsAdapter(
      app as NestApplication,
      corsOrigins,
      createAdapter(pubClient, subClient),
    ),
  );

  const apiPrefix = config.get('apiPrefix', { infer: true }) ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true }) ?? 3000;
  const env = config.get('nodeEnv', { infer: true }) ?? 'development';
  const swaggerEnabled = config.get('swaggerEnabled', { infer: true }) ?? false;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LMS API')
      .setDescription('Learning Management System REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger UI available at /api/docs');
  }

  await app.listen(port);
  logger.log(`Application running on port ${String(port)} [${env}]`);
}

void bootstrap();
