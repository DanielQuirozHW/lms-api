import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ImpersonationLogService } from './impersonation.log.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, ImpersonationLogService],
})
export class AdminModule {}
