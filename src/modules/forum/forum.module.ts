import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ForumController } from './forum.controller';
import { ForumGateway } from './forum.gateway';
import { ForumRepository } from './forum.repository';
import { ForumService } from './forum.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ForumController],
  providers: [ForumService, ForumRepository, ForumGateway],
})
export class ForumModule {}
