import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { AdminService } from './admin.service';
import { StopImpersonationDto } from './dto/stop-impersonation.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // NOTE: 'impersonate/stop' must be declared before 'impersonate/:userId' so NestJS
  // does not match the literal segment 'stop' as the :userId parameter.

  /**
   * @Roles is intentionally absent here. The caller holds an impersonation token (type: 'access',
   * but with target-user roles, NOT the admin's ADMIN role). RolesGuard would reject it if
   * @Roles(UserRole.ADMIN) were applied. Authorization is handled by ImpersonationGuard in the
   * global chain, which validates the impersonationTokenId claim and that the admin still exists.
   */
  @Post('impersonate/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop impersonating — revoke impersonation token and restore admin session',
  })
  @ApiResponse({ status: 200, description: 'Admin session restored', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'No active impersonation session or adminId mismatch' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  stopImpersonation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StopImpersonationDto,
  ): Promise<AuthResponseDto> {
    return this.adminService.stopImpersonation(user, dto);
  }

  @Post('impersonate/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Impersonate a STUDENT or INSTRUCTOR (admin only)' })
  @ApiResponse({ status: 201, description: 'Impersonation tokens issued', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot impersonate yourself' })
  @ApiResponse({ status: 403, description: 'Target is ADMIN, or caller is already impersonating' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  startImpersonation(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<AuthResponseDto> {
    return this.adminService.startImpersonation(admin, targetUserId);
  }
}
