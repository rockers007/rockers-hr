import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CalendarService } from './calendar.service';
import { LeaveRequest } from '../leave/entities/leave-request.entity';

// Mock googleapis
jest.mock('googleapis', () => {
  const mockInsert = jest.fn().mockResolvedValue({
    data: { id: 'mock-event-id' },
  });
  const mockDelete = jest.fn().mockResolvedValue({});
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock'),
          getToken: jest.fn().mockResolvedValue({
            tokens: { access_token: 'mock-access', refresh_token: 'mock-refresh' },
          }),
          setCredentials: jest.fn(),
        })),
      },
      calendar: jest.fn().mockReturnValue({
        events: {
          insert: mockInsert,
          delete: mockDelete,
        },
      }),
    },
  };
});

describe('CalendarService', () => {
  let service: CalendarService;
  let leaveRequestRepo: any;

  const mockLeaveRequestRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  };

  const mockConfigWithCalendar = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        GOOGLE_CALENDAR_CLIENT_ID: 'test-client-id',
        GOOGLE_CALENDAR_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/v1/calendar/oauth/callback',
      };
      return config[key] ?? defaultValue ?? undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: mockLeaveRequestRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigWithCalendar,
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    service.onModuleInit();
    leaveRequestRepo = mockLeaveRequestRepo;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report as configured when credentials are present', () => {
    expect(service.isConfigured()).toBe(true);
  });

  describe('createEvent', () => {
    const params = {
      leaveRequestId: 'lr-123',
      employeeName: 'Priya Sharma',
      employeeEmail: 'priya@gmail.com',
      leaveTypeLabel: 'Casual Leave',
      startDate: '2025-06-15',
      endDate: '2025-06-16',
      workingDays: 2,
    };

    it('should create a calendar event and update leave request', async () => {
      const eventId = await service.createEvent(params);

      expect(eventId).toBe('mock-event-id');
      expect(leaveRequestRepo.update).toHaveBeenCalledWith('lr-123', {
        calendar_event_id: 'mock-event-id',
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete a calendar event', async () => {
      const result = await service.deleteEvent('event-123');
      expect(result).toBe(true);
    });
  });

  describe('getAuthUrl', () => {
    it('should return an OAuth URL', () => {
      const url = service.getAuthUrl();
      expect(url).toContain('https://accounts.google.com');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      const tokens = await service.exchangeCode('test-code');
      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
    });
  });

  describe('getTeamCalendar', () => {
    it('should return calendar-friendly leave events', async () => {
      const mockData = [
        {
          id: 'lr-1',
          start_date: '2025-06-15',
          end_date: '2025-06-16',
          working_days: 2,
          user: { id: 'u-1', name: 'Priya Sharma' },
          leaveType: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
          durationType: { label: 'Full Day' },
        },
      ];

      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockData),
      };
      mockLeaveRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getTeamCalendar({
        from: '2025-06-01',
        to: '2025-06-30',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'lr-1',
        title: '[Casual Leave] Priya Sharma',
        start: '2025-06-15',
        end: '2025-06-16',
        color: '#3b82f6',
        employee: { id: 'u-1', name: 'Priya Sharma' },
        leave_type: { id: 'lt-1', label: 'Casual Leave', color: '#3b82f6' },
        duration_type: 'Full Day',
        working_days: 2,
      });

      // Verify filters were applied
      expect(mockQb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should filter by department when provided', async () => {
      const mockQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockLeaveRequestRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.getTeamCalendar({ department_id: 'dept-1' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'user.department_id = :deptId',
        { deptId: 'dept-1' },
      );
    });
  });
});

describe('CalendarService (not configured)', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: { update: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    service.onModuleInit();
  });

  it('should report as not configured', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('should return null for createEvent when not configured', async () => {
    const result = await service.createEvent({
      leaveRequestId: 'lr-1',
      employeeName: 'Test',
      employeeEmail: 'test@gmail.com',
      leaveTypeLabel: 'Casual Leave',
      startDate: '2025-06-15',
      endDate: '2025-06-16',
      workingDays: 2,
    });
    expect(result).toBeNull();
  });

  it('should return false for deleteEvent when not configured', async () => {
    const result = await service.deleteEvent('event-1');
    expect(result).toBe(false);
  });

  it('should return null for getAuthUrl when not configured', () => {
    expect(service.getAuthUrl()).toBeNull();
  });
});
