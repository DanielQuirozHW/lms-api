import { HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

const mockResponse = (): jest.Mocked<Pick<Response, 'status' | 'json'>> => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let redisService: { ping: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    redisService = { ping: jest.fn().mockResolvedValue('PONG') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok when both services are healthy', async () => {
    const res = mockResponse();
    await controller.check(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', services: { database: 'ok', redis: 'ok' } }),
    );
  });

  it('returns degraded with HTTP 200 when database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
    const res = mockResponse();
    await controller.check(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'error', redis: 'ok' },
      }),
    );
  });

  it('returns degraded with HTTP 200 when redis fails', async () => {
    redisService.ping.mockRejectedValue(new Error('Redis error'));
    const res = mockResponse();
    await controller.check(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        services: { database: 'ok', redis: 'error' },
      }),
    );
  });

  it('returns error with HTTP 503 when both services fail', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
    redisService.ping.mockRejectedValue(new Error('Redis error'));
    const res = mockResponse();
    await controller.check(res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', services: { database: 'error', redis: 'error' } }),
    );
  });
});
