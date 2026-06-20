import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { version as pkgVersion } from '../../package.json';

interface VersionResponse {
  version: string;
}

type ServiceStatus = 'ok' | 'error';
type HealthStatus = 'ok' | 'degraded' | 'error';

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get('version')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get API version' })
  @ApiResponse({ status: 200, description: 'Current API version' })
  getVersion(): VersionResponse {
    return { version: process.env['APP_VERSION'] ?? pkgVersion };
  }

  @Public()
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Check API health status' })
  @ApiResponse({ status: 200, description: 'Service is healthy or degraded' })
  @ApiResponse({ status: 503, description: 'All services unavailable' })
  async check(@Res() res: Response): Promise<void> {
    const [database, redis] = await Promise.all([
      (this.prisma.$queryRaw`SELECT 1` as Promise<unknown>)
        .then(() => 'ok' as const)
        .catch(() => 'error' as const),
      this.redisService
        .ping()
        .then(() => 'ok' as const)
        .catch(() => 'error' as const),
    ]);

    const failCount = [database, redis].filter((s) => s === 'error').length;
    let status: HealthStatus;
    let httpStatus: number;

    if (failCount === 0) {
      status = 'ok';
      httpStatus = HttpStatus.OK;
    } else if (failCount < 2) {
      status = 'degraded';
      httpStatus = HttpStatus.OK;
    } else {
      status = 'error';
      httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
    }

    const body: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };

    res.status(httpStatus).json(body);
  }
}
