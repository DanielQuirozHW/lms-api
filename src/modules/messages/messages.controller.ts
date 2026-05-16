import { Controller } from '@nestjs/common';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(protected readonly messagesService: MessagesService) {}
}
