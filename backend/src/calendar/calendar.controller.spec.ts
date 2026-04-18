import { Test, TestingModule } from '@nestjs/testing';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

describe('CalendarController', () => {
  let controller: CalendarController;
  let service: CalendarService;

  const mockCalendarService = {
    getTeamCalendar: jest.fn(),
    getAuthUrl: jest.fn(),
    exchangeCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        {
          provide: CalendarService,
          useValue: mockCalendarService,
        },
      ],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
    service = module.get<CalendarService>(CalendarService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTeamCalendar', () => {
    it('should return calendar events wrapped in data envelope', async () => {
      const mockEvents = [
        {
          id: 'lr-1',
          title: '[Casual Leave] Priya',
          start: '2025-06-15',
          end: '2025-06-16',
          color: '#3b82f6',
        },
      ];
      mockCalendarService.getTeamCalendar.mockResolvedValue(mockEvents);

      const result = await controller.getTeamCalendar(
        '2025-06-01',
        '2025-06-30',
        undefined,
      );

      expect(result).toEqual({ data: mockEvents });
      expect(mockCalendarService.getTeamCalendar).toHaveBeenCalledWith({
        from: '2025-06-01',
        to: '2025-06-30',
        department_id: undefined,
      });
    });
  });

  describe('getOAuthUrl', () => {
    it('should return auth URL when configured', () => {
      mockCalendarService.getAuthUrl.mockReturnValue(
        'https://accounts.google.com/auth?mock',
      );

      const result = controller.getOAuthUrl();
      expect(result).toEqual({
        data: { auth_url: 'https://accounts.google.com/auth?mock' },
      });
    });

    it('should return error when not configured', () => {
      mockCalendarService.getAuthUrl.mockReturnValue(null);

      const result = controller.getOAuthUrl();
      expect(result).toHaveProperty('error');
      expect((result as any).error.code).toBe('CALENDAR_NOT_CONFIGURED');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should exchange code and return success', async () => {
      mockCalendarService.exchangeCode.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
      });

      const result = await controller.handleOAuthCallback('test-code');
      expect(result).toEqual({
        data: { status: 'calendar_connected', has_refresh_token: true },
      });
    });

    it('should return error when code is missing', async () => {
      const result = await controller.handleOAuthCallback(undefined as any);
      expect(result).toHaveProperty('error');
      expect((result as any).error.code).toBe('MISSING_CODE');
    });
  });
});
