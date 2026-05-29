import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MaintenanceResponseDto, SetMaintenanceDto } from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@Controller('admin/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get current maintenance mode state' })
  @ApiResponse({ status: 200, type: MaintenanceResponseDto })
  getState(): Promise<MaintenanceResponseDto> {
    return this.maintenanceService.getState();
  }

  @Post()
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable maintenance mode (admin only)' })
  @ApiResponse({ status: 200, type: MaintenanceResponseDto })
  setState(@Body() dto: SetMaintenanceDto): Promise<MaintenanceResponseDto> {
    return this.maintenanceService.setState(dto);
  }
}
