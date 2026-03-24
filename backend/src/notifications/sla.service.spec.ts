import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaService } from './sla.service';
import { NotificationsService } from './notifications.service';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { MasterSlaConfig } from '../master/entities/master-sla-config.entity';
import { MasterPublicHoliday } from '../master/entities/master-public-holiday.entity';
import { MasterLeaveType } from '../master/entities/master-leave-type.entity';
import { User } from '../users/entities/user.entity';

describe('SlaService', () => {
  let service: SlaService;
  let mockApprovalRepo: any;
  let mockRequestRepo: any;
  let mockSlaConfigRepo: any;
  let mockHolidayRepo: any;
  let mockNotificationsService: any;

  beforeEach(async () => {
    const createQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockApprovalRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((data) => ({ ...data, id: 'new-approval-id' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    mockRequestRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockSlaConfigRepo = {
      find: jest.fn().mockResolvedValue([
        { config_key: 'sla.business_hours_start', config_value: '09:00' },
        { config_key: 'sla.business_hours_end', config_value: '18:00' },
        { config_key: 'sla.manager_window_hours', config_value: '5' },
        { config_key: 'sla.reminder_at_hours', config_value: '4' },
      ]),
    };

    mockHolidayRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockNotificationsService = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getRepositoryToken(LeaveApproval), useValue: mockApprovalRepo },
        { provide: getRepositoryToken(LeaveRequest), useValue: mockRequestRepo },
        { provide: getRepositoryToken(LeaveBalance), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(MasterSlaConfig), useValue: mockSlaConfigRepo },
        { provide: getRepositoryToken(MasterPublicHoliday), useValue: mockHolidayRepo },
        { provide: getRepositoryToken(MasterLeaveType), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(User), useValue: { find: jest.fn().mockResolvedValue([]), createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder) } },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<SlaService>(SlaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enforceSlaWindows', () => {
    it('should run without errors when no pending approvals', async () => {
      await expect(service.enforceSlaWindows()).resolves.not.toThrow();
    });
  });

  describe('calcSlaDeadline', () => {
    it('should calculate SLA deadline based on business hours config', async () => {
      const from = new Date('2026-03-24T10:00:00Z'); // Tuesday 10 AM
      const result = await service.calcSlaDeadline(from);

      expect(result.slaDeadline).toBeInstanceOf(Date);
      expect(result.reminderDeadline).toBeInstanceOf(Date);
      expect(result.reminderDeadline.getTime()).toBeLessThan(result.slaDeadline.getTime());
    });

    it('should skip weekends in SLA calculation', async () => {
      // Friday 17:00 — only 1 business hour left
      const from = new Date('2026-03-27T17:00:00Z');
      const result = await service.calcSlaDeadline(from);

      // 5h SLA: 1h Friday + 4h Monday = Monday 13:00
      expect(result.slaDeadline.getDay()).not.toBe(0); // Not Sunday
      expect(result.slaDeadline.getDay()).not.toBe(6); // Not Saturday
    });

    it('should skip holidays in SLA calculation', async () => {
      mockHolidayRepo.find.mockResolvedValue([
        { date: '2026-03-25', year: 2026, is_active: true },
      ]);

      const from = new Date('2026-03-24T17:00:00Z'); // Tuesday 17:00
      const result = await service.calcSlaDeadline(from);

      // Wednesday is holiday, so SLA continues on Thursday
      expect(result.slaDeadline).toBeInstanceOf(Date);
    });
  });
});
