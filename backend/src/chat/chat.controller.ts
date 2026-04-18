import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(200)
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: any,
  ) {
    // TODO: Replace with actual user ID from JWT auth guard once auth module is ready
    const userId = req.user?.id ?? req.headers['x-user-id'];
    if (!userId) {
      return {
        error: 'User not authenticated',
      };
    }

    const assistantMsg = await this.chatService.sendMessage(
      userId,
      dto.message,
    );

    return {
      data: {
        id: assistantMsg.id,
        message: assistantMsg.message,
        role: assistantMsg.role,
        created_at: assistantMsg.created_at,
      },
    };
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const userId = req.user?.id ?? req.headers['x-user-id'];
    if (!userId) {
      return { error: 'User not authenticated' };
    }

    const messages = await this.chatService.getConversationHistory(userId);

    return {
      data: messages.map((msg) => ({
        id: msg.id,
        message: msg.message,
        role: msg.role,
        created_at: msg.created_at,
      })),
    };
  }
}
