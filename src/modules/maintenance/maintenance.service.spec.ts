import { Test, type TestingModule } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let redisService: jest.Mocked<Pick<RedisService, 'get' | 'set'>>;

  beforeEach(async () => {
    redisService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MaintenanceService, { provide: RedisService, useValue: redisService }],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getState', () => {
    it('returns disabled state when Redis key is not set', async () => {
      redisService.get.mockResolvedValue(null);
      const result = await service.getState();
      expect(result).toEqual({ enabled: false, message: '' });
    });

    it('returns persisted state from Redis', async () => {
      redisService.get.mockResolvedValue(
        JSON.stringify({
          enabled: true,
          message: 'Down for maintenance',
          estimatedEnd: '2026-06-01T04:00:00Z',
        }),
      );
      const result = await service.getState();
      expect(result.enabled).toBe(true);
      expect(result.message).toBe('Down for maintenance');
      expect(result.estimatedEnd).toBe('2026-06-01T04:00:00Z');
    });
  });

  describe('setState', () => {
    it('persists state to Redis and returns it', async () => {
      const result = await service.setState({
        enabled: true,
        message: 'Maintenance in progress',
        estimatedEnd: '2026-06-01T04:00:00Z',
      });

      expect(redisService.set).toHaveBeenCalledWith(
        'platform:maintenance',
        JSON.stringify({
          enabled: true,
          message: 'Maintenance in progress',
          estimatedEnd: '2026-06-01T04:00:00Z',
        }),
      );
      expect(result.enabled).toBe(true);
    });

    it('disables maintenance mode', async () => {
      const result = await service.setState({ enabled: false, message: '' });
      expect(result.enabled).toBe(false);
    });
  });
});
