import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { InboxItemDto } from './dto/inbox-item.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get inbox — one entry per conversation partner' })
  @ApiResponse({ status: 200, description: 'Paginated inbox list' })
  getInbox(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<InboxItemDto>> {
    return this.messagesService.getInbox(user.id, pagination);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get conversation with a specific user' })
  @ApiResponse({ status: 200, description: 'Paginated conversation' })
  getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') partnerId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    return this.messagesService.getConversation(user.id, partnerId, pagination);
  }

  @Post(':userId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to a user' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') receiverId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.messagesService.send(user.id, receiverId, dto);
    this.messagesGateway.emitToUser(receiverId, 'newMessage', message);
    return message;
  }

  @Patch(':userId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all messages from a user as read' })
  @ApiResponse({ status: 204 })
  async markConversationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') senderId: string,
  ): Promise<void> {
    await this.messagesService.markConversationRead(user.id, senderId);
    this.messagesGateway.emitToUser(senderId, 'messagesRead', { by: user.id });
  }
}
