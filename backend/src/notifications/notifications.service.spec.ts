import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { MasterNotificationTemplate } from '../master/entities/master-notification-template.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockNotificationRepo: any;
  let mockTemplateRepo: any;

  beforeEach(async () => {
    mockNotificationRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'notif-uuid-1', created_at: new Date() })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };

    mockTemplateRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(MasterNotificationTemplate),
          useValue: mockTemplateRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('renderTemplate', () => {
    it('should replace tokens with values', () => {
      const result = service.renderTemplate(
        'Hello {{employee_name}}, your {{leave_type}} for {{dates}} is pending.',
        {
          employee_name: 'John',
          leave_type: 'Casual Leave',
          dates: 'Jun 15–16, 2025',
        },
      );
      expect(result).toBe(
        'Hello John, your Casual Leave for Jun 15–16, 2025 is pending.',
      );
    });

    it('should leave unresolved tokens as-is', () => {
      const result = service.renderTemplate(
        'Hello {{employee_name}}, {{unknown_token}}',
        { employee_name: 'John' },
      );
      expect(result).toBe('Hello John, {{unknown_token}}');
    });

    it('should handle empty tokens', () => {
      const result = service.renderTemplate('No tokens here', {});
      expect(result).toBe('No tokens here');
    });
  });

  describe('dispatch', () => {
    it('should create in-app notification when template channel is both', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 'tpl-1',
        event_key: 'leave.submitted.employee',
        subject_template: 'Leave Request — {{leave_type}}',
        body_template: 'Hi {{employee_name}}, your request is submitted.',
        channel: 'both',
        is_active: true,
      });

      await service.dispatch(
        'leave.submitted.employee',
        [{ userId: 'user-1', email: 'john@gmail.com' }],
        { employee_name: 'John', leave_type: 'Casual Leave' },
      );

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          event_key: 'leave.submitted.employee',
          rendered_title: 'Leave Request — Casual Leave',
          rendered_body: 'Hi John, your request is submitted.',
          channel: 'both',
        }),
      );
      expect(mockNotificationRepo.save).toHaveBeenCalled();
    });

    it('should not create notification when template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await service.dispatch(
        'nonexistent.event',
        [{ userId: 'user-1', email: 'john@gmail.com' }],
        {},
      );

      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });

    it('should skip in-app notification when channel is email only', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 'tpl-1',
        event_key: 'test.email.only',
        subject_template: 'Test',
        body_template: 'Body',
        channel: 'email',
        is_active: true,
      });

      await service.dispatch(
        'test.email.only',
        [{ userId: 'user-1', email: 'john@gmail.com' }],
        {},
      );

      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockData = [
        { id: '1', event_key: 'test', rendered_title: 'Test', rendered_body: 'Body', is_read: false, created_at: new Date() },
      ];
      mockNotificationRepo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.getNotifications('user-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by is_read when provided', async () => {
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getNotifications('user-1', { is_read: false, page: 1, limit: 20 });

      expect(mockNotificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-1', is_read: false },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('markAsRead', () => {
    it('should update notification is_read to true', async () => {
      await service.markAsRead('user-1', 'notif-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { id: 'notif-1', user_id: 'user-1' },
        { is_read: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      await service.markAllAsRead('user-1');

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { user_id: 'user-1', is_read: false },
        { is_read: true },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockNotificationRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(5);
    });
  });
});
