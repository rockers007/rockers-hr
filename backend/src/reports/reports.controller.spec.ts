import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockMonthlyReport = {
    period: 'June 2025',
    summary: { total_days: 10, approved: 8, declined: 2, approval_rate_pct: 80, sla_compliance_pct: 90 },
    by_type: [],
    by_employee: [],
    sla_performance: { within_sla: 9, escalated: 1, breached: 1 },
  };

  const mockYearlyReport = {
    year: 2025,
    summary: { total_days: 100, total_requests: 20, approval_rate_pct: 85 },
    monthly_trend: [],
    by_employee: [],
  };

  const mockBalanceReport = [
    {
      employee_name: 'Alice',
      department: 'Eng',
      unused_leaves: [{ leave_type: 'CL', total: 12, used: 10, available: 2 }],
      total_unused_days: 2,
    },
  ];

  const mockService = {
    getMonthlyReport: jest.fn().mockResolvedValue(mockMonthlyReport),
    getYearlyReport: jest.fn().mockResolvedValue(mockYearlyReport),
    getLeaveBalanceReport: jest.fn().mockResolvedValue(mockBalanceReport),
    generateMonthlyCsv: jest.fn().mockReturnValue('csv-data'),
    generateYearlyCsv: jest.fn().mockReturnValue('csv-data'),
    generateBalanceCsv: jest.fn().mockReturnValue('csv-data'),
    generateMonthlyPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
    generateYearlyPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /admin/reports/monthly', () => {
    it('should return monthly report data', async () => {
      const result = await controller.getMonthlyReport({ month: 6, year: 2025 });
      expect(result).toEqual({ data: mockMonthlyReport });
      expect(service.getMonthlyReport).toHaveBeenCalledWith(6, 2025, undefined);
    });

    it('should pass department_id filter', async () => {
      await controller.getMonthlyReport({ month: 6, year: 2025, department_id: 'dept-1' });
      expect(service.getMonthlyReport).toHaveBeenCalledWith(6, 2025, 'dept-1');
    });
  });

  describe('GET /admin/reports/yearly', () => {
    it('should return yearly report data', async () => {
      const result = await controller.getYearlyReport({ year: 2025 });
      expect(result).toEqual({ data: mockYearlyReport });
      expect(service.getYearlyReport).toHaveBeenCalledWith(2025, undefined);
    });
  });

  describe('GET /admin/reports/leave-balance', () => {
    it('should return leave balance report data', async () => {
      const result = await controller.getLeaveBalanceReport({ year: 2025 });
      expect(result).toEqual({ data: mockBalanceReport });
      expect(service.getLeaveBalanceReport).toHaveBeenCalledWith(2025, undefined);
    });
  });

  describe('export endpoints', () => {
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as any;

    it('should export monthly CSV', async () => {
      await controller.exportMonthlyReport(
        { month: 6, year: 2025, format: 'csv' },
        mockRes,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.send).toHaveBeenCalledWith('csv-data');
    });

    it('should export monthly PDF', async () => {
      await controller.exportMonthlyReport(
        { month: 6, year: 2025, format: 'pdf' },
        mockRes,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should export yearly CSV', async () => {
      await controller.exportYearlyReport(
        { year: 2025, format: 'csv' },
        mockRes,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });

    it('should export yearly PDF', async () => {
      await controller.exportYearlyReport(
        { year: 2025, format: 'pdf' },
        mockRes,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });

    it('should export balance CSV', async () => {
      await controller.exportLeaveBalanceReport(
        { year: 2025, format: 'csv' },
        mockRes,
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });
  });
});
