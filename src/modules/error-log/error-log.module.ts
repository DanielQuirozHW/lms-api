import { Module } from '@nestjs/common';
import { ErrorLogService } from './error-log.service';

@Module({
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
