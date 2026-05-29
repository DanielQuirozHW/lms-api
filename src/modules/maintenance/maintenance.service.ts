import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { MaintenanceResponseDto, SetMaintenanceDto } from './dto/maintenance.dto';

const REDIS_KEY = 'platform:maintenance';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  estimatedEnd?: string;
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly redisService: RedisService) {}

  async getState(): Promise<MaintenanceState> {
    const raw = await this.redisService.get(REDIS_KEY);
    if (!raw) return { enabled: false, message: '' };
    return JSON.parse(raw) as MaintenanceState;
  }

  async setState(dto: SetMaintenanceDto): Promise<MaintenanceResponseDto> {
    const state: MaintenanceState = {
      enabled: dto.enabled,
      message: dto.message,
      estimatedEnd: dto.estimatedEnd,
    };
    await this.redisService.set(REDIS_KEY, JSON.stringify(state));
    return state;
  }
}
