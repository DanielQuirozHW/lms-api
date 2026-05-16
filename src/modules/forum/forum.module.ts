import { Module } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { ForumGateway } from './forum.gateway';
import { ForumService } from './forum.service';

@Module({
  controllers: [ForumController],
  providers: [ForumService, ForumGateway],
})
export class ForumModule {}
