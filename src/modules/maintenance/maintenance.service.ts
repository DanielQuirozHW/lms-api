import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { MaintenanceResponseDto, SetMaintenanceDto } from './dto/maintenance.dto';

const REDIS_KEY = 'platform:maintenance';

export interface MaintenanceState {
  isEnabled: boolean;
  message: string | null;
  estimatedEnd?: string | null;
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly redisService: RedisService) {}

  async getState(): Promise<MaintenanceResponseDto> {
    const raw = await this.redisService.get(REDIS_KEY);
    if (!raw) return { isEnabled: false, message: null, estimatedEnd: null };
    // Support both old format ({ enabled }) and new format ({ isEnabled })
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      isEnabled: (parsed['isEnabled'] ?? parsed['enabled'] ?? false) as boolean,
      message: (parsed['message'] as string | null) ?? null,
      estimatedEnd: (parsed['estimatedEnd'] as string | null | undefined) ?? null,
    };
  }

  async setState(dto: SetMaintenanceDto): Promise<MaintenanceResponseDto> {
    const state: MaintenanceState = {
      isEnabled: dto.enabled,
      message: dto.message,
      estimatedEnd: dto.estimatedEnd ?? null,
    };
    await this.redisService.set(REDIS_KEY, JSON.stringify(state));
    return {
      isEnabled: state.isEnabled,
      message: state.message,
      estimatedEnd: state.estimatedEnd ?? null,
    };
  }
}
