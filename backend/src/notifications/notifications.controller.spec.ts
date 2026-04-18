import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      getNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      getUnreadCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/v1/notifications', () => {
    it('should return paginated notifications', async () => {
      mockService.getNotifications.mockResolvedValue({
        data: [
          { id: '1', event_key: 'test', rendered_title: 'Title', rendered_body: 'Body', channel: 'both', is_read: false, created_at: new Date() },
        ],
        total: 1,
      });

      const result = await controller.getNotifications(
        { page: 1, limit: 20 },
        { headers: { 'x-user-id': 'user-1' } },
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta!.total).toBe(1);
    });

    it('should return error when not authenticated', async () => {
      const result = await controller.getNotifications(
        { page: 1, limit: 20 },
        { headers: {} },
      );
      expect(result).toEqual({ error: 'User not authenticated' });
    });
  });

  describe('GET /api/v1/notifications/count', () => {
    it('should return unread count', async () => {
      mockService.getUnreadCount.mockResolvedValue(3);

      const result = await controller.getUnreadCount({
        headers: { 'x-user-id': 'user-1' },
      });

      expect(result).toEqual({ data: { unread: 3 } });
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      mockService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead('notif-1', {
        headers: { 'x-user-id': 'user-1' },
      });

      expect(result).toEqual({ data: { success: true } });
      expect(mockService.markAsRead).toHaveBeenCalledWith('user-1', 'notif-1');
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      mockService.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead({
        headers: { 'x-user-id': 'user-1' },
      });

      expect(result).toEqual({ data: { success: true } });
      expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });
});
