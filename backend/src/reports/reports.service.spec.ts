import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { User } from '../users/entities/user.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let leaveRequestRepo: any;
  let leaveBalanceRepo: any;
  let leaveApprovalRepo: any;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
          },
        },
        {
          provide: getRepositoryToken(LeaveBalance),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
          },
        },
        {
          provide: getRepositoryToken(LeaveApproval),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({ ...mockQueryBuilder }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    leaveRequestRepo = module.get(getRepositoryToken(LeaveRequest));
    leaveBalanceRepo = module.get(getRepositoryToken(LeaveBalance));
    leaveApprovalRepo = module.get(getRepositoryToken(LeaveApproval));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMonthlyReport', () => {
    it('should return report structure with empty data', async () => {
      const result = await service.getMonthlyReport(6, 2025);

      expect(result).toHaveProperty('period', 'June 2025');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('total_days', 0);
      expect(result.summary).toHaveProperty('approved', 0);
      expect(result.summary).toHaveProperty('declined', 0);
      expect(result.summary).toHaveProperty('approval_rate_pct', 0);
      expect(result.summary).toHaveProperty('sla_compliance_pct', 100);
      expect(result).toHaveProperty('by_type');
      expect(result).toHaveProperty('by_employee');
      expect(result).toHaveProperty('sla_performance');
    });

    it('should filter by department when provided', async () => {
      const qb = leaveRequestRepo.createQueryBuilder();
      await service.getMonthlyReport(6, 2025, 'dept-uuid');

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should calculate approval rate correctly with data', async () => {
      const mockRequests = [
        { working_days: 2, status: 'APPROVED', user_id: 'u1', leaveType: { label: 'CL', color: '#3b82f6' }, user: { name: 'Alice', department: { label: 'Eng' } } },
        { working_days: 1, status: 'APPROVED', user_id: 'u1', leaveType: { label: 'CL', color: '#3b82f6' }, user: { name: 'Alice', department: { label: 'Eng' } } },
        { working_days: 3, status: 'DECLINED', user_id: 'u2', leaveType: { label: 'SL', color: '#ef4444' }, user: { name: 'Bob', department: { label: 'Sales' } } },
      ];

      const requestQb = { ...mockQueryBuilder, getMany: jest.fn().mockResolvedValue(mockRequests) };
      const approvalQb = { ...mockQueryBuilder, getMany: jest.fn().mockResolvedValue([]) };

      leaveRequestRepo.createQueryBuilder = jest.fn().mockReturnValue(requestQb);
      leaveApprovalRepo.createQueryBuilder = jest.fn().mockReturnValue(approvalQb);

      const result = await service.getMonthlyReport(6, 2025);

      expect(result.summary.total_days).toBe(6);
      expect(result.summary.approved).toBe(3);
      expect(result.summary.declined).toBe(3);
      expect(result.summary.approval_rate_pct).toBe(67); // 2/3
      expect(result.by_type).toHaveLength(2);
      expect(result.by_employee).toHaveLength(2);
    });
  });

  describe('getYearlyReport', () => {
    it('should return report structure with monthly trend', async () => {
      const result = await service.getYearlyReport(2025);

      expect(result).toHaveProperty('year', 2025);
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('monthly_trend');
      expect(result.monthly_trend).toHaveLength(12);
      expect(result).toHaveProperty('by_employee');
    });
  });

  describe('getLeaveBalanceReport', () => {
    it('should return empty array when no unused balances', async () => {
      const result = await service.getLeaveBalanceReport(2025);
      expect(result).toEqual([]);
    });

    it('should group unused balances by employee', async () => {
      const mockBalances = [
        {
          user_id: 'u1',
          total_days: 12,
          used_days: 10,
          pending_days: 0,
          user: { name: 'Alice', department: { label: 'Eng' } },
          leaveType: { label: 'Casual Leave' },
        },
        {
          user_id: 'u1',
          total_days: 15,
          used_days: 5,
          pending_days: 2,
          user: { name: 'Alice', department: { label: 'Eng' } },
          leaveType: { label: 'Paid Leave' },
        },
      ];

      const qb = { ...mockQueryBuilder, getMany: jest.fn().mockResolvedValue(mockBalances) };
      leaveBalanceRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.getLeaveBalanceReport(2025);

      expect(result).toHaveLength(1);
      expect(result[0].employee_name).toBe('Alice');
      expect(result[0].unused_leaves).toHaveLength(2);
      expect(result[0].total_unused_days).toBe(10); // 2 + 8
    });
  });

  describe('CSV generation', () => {
    it('should generate monthly CSV', () => {
      const report = {
        period: 'June 2025',
        summary: { total_days: 10, approved: 8, declined: 2, approval_rate_pct: 80, sla_compliance_pct: 90 },
        by_type: [{ leave_type: 'Casual Leave', color: '#3b82f6', days: 10 }],
        by_employee: [
          { employee_name: 'Alice', department: 'Eng', days_by_type: { 'Casual Leave': 5 } },
        ],
        sla_performance: { within_sla: 9, escalated: 1, breached: 1 },
      };

      const csv = service.generateMonthlyCsv(report);
      expect(csv).toContain('Employee,Department,Leave Type,Days');
      expect(csv).toContain('Alice');
      expect(csv).toContain('Casual Leave');
    });

    it('should generate yearly CSV with monthly trend', () => {
      const report = {
        year: 2025,
        summary: { total_days: 100, total_requests: 20, approval_rate_pct: 85 },
        monthly_trend: Array.from({ length: 12 }, (_, i) => ({
          month: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i + 1],
          days: 0,
        })),
        by_employee: [],
      };

      const csv = service.generateYearlyCsv(report);
      expect(csv).toContain('Monthly Trend');
      expect(csv).toContain('January');
    });

    it('should generate balance CSV', () => {
      const report = [
        {
          employee_name: 'Alice',
          department: 'Eng',
          unused_leaves: [{ leave_type: 'CL', total: 12, used: 10, available: 2 }],
          total_unused_days: 2,
        },
      ];

      const csv = service.generateBalanceCsv(report);
      expect(csv).toContain('Employee,Department,Leave Type,Total,Used,Available');
      expect(csv).toContain('Alice');
    });
  });

  describe('PDF generation', () => {
    it('should generate monthly PDF buffer', async () => {
      const report = {
        period: 'June 2025',
        summary: { total_days: 0, approved: 0, declined: 0, approval_rate_pct: 0, sla_compliance_pct: 100 },
        by_type: [],
        by_employee: [],
        sla_performance: { within_sla: 0, escalated: 0, breached: 0 },
      };

      const pdf = await service.generateMonthlyPdf(report);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // PDF magic bytes: %PDF
      expect(pdf.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should generate yearly PDF buffer', async () => {
      const report = {
        year: 2025,
        summary: { total_days: 0, total_requests: 0, approval_rate_pct: 0 },
        monthly_trend: Array.from({ length: 12 }, (_, i) => ({ month: `Month ${i + 1}`, days: 0 })),
        by_employee: [],
      };

      const pdf = await service.generateYearlyPdf(report);
      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });
});
