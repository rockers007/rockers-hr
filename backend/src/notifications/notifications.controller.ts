import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query() query: GetNotificationsDto,
    @CurrentUser('sub') userId: string,
  ) {
    const { data, total } = await this.notificationsService.getNotifications(
      userId,
      {
        is_read: query.is_read,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
    );

    return {
      data: data.map((n) => ({
        id: n.id,
        event_key: n.event_key,
        rendered_title: n.rendered_title,
        rendered_body: n.rendered_body,
        channel: n.channel,
        is_read: n.is_read,
        created_at: n.created_at,
      })),
      meta: {
        total,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
    };
  }

  @Get('count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    const unread = await this.notificationsService.getUnreadCount(userId);
    return { data: { unread } };
  }

  @Patch(':id/read')
  @HttpCode(200)
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.notificationsService.markAsRead(userId, id);
    return { data: { success: true } };
  }

  @Patch('read-all')
  @HttpCode(200)
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { data: { success: true } };
  }
}
