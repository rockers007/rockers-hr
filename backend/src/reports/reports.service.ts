import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest } from '../leave/entities/leave-request.entity';
import { LeaveBalance } from '../leave/entities/leave-balance.entity';
import { LeaveApproval } from '../leave/entities/leave-approval.entity';
import { User } from '../users/entities/user.entity';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveApproval)
    private readonly leaveApprovalRepo: Repository<LeaveApproval>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getMonthlyReport(month: number, year: number, departmentId?: string) {
    const qb = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('lr.user', 'u')
      .leftJoin('u.department', 'd')
      .addSelect(['d.id', 'd.label'])
      .where(
        `EXTRACT(MONTH FROM lr.start_date) = :month AND EXTRACT(YEAR FROM lr.start_date) = :year`,
        { month, year },
      )
      .andWhere('lr.status != :cancelled', { cancelled: 'CANCELLED' });

    if (departmentId) {
      qb.andWhere('u.department_id = :departmentId', { departmentId });
    }

    const requests = await qb.getMany();

    const totalDays = requests.reduce((sum, r) => sum + Number(r.working_days), 0);
    const approved = requests.filter((r) => r.status === 'APPROVED');
    const declined = requests.filter((r) => r.status === 'DECLINED');
    const approvedDays = approved.reduce((sum, r) => sum + Number(r.working_days), 0);
    const declinedDays = declined.reduce((sum, r) => sum + Number(r.working_days), 0);
    const totalDecisions = approved.length + declined.length;
    const approvalRatePct = totalDecisions > 0 ? Math.round((approved.length / totalDecisions) * 100) : 0;

    // SLA compliance
    const slaApprovals = await this.leaveApprovalRepo
      .createQueryBuilder('la')
      .leftJoin('la.leaveRequest', 'lr')
      .leftJoin('lr.user', 'u')
      .where(
        `EXTRACT(MONTH FROM la.created_at) = :month AND EXTRACT(YEAR FROM la.created_at) = :year`,
        { month, year },
      )
      .andWhere('la.level = 1')
      .andWhere(departmentId ? 'u.department_id = :departmentId' : '1=1', { departmentId })
      .getMany();

    const withinSla = slaApprovals.filter((a) => !a.escalated).length;
    const escalated = slaApprovals.filter((a) => a.escalated).length;
    const slaCompliancePct = slaApprovals.length > 0 ? Math.round((withinSla / slaApprovals.length) * 100) : 100;

    // By type
    const byTypeMap = new Map<string, { leave_type: string; color: string; days: number }>();
    for (const r of requests) {
      const key = r.leaveType?.label || 'Unknown';
      const existing = byTypeMap.get(key) || { leave_type: key, color: r.leaveType?.color || '#6b7280', days: 0 };
      existing.days += Number(r.working_days);
      byTypeMap.set(key, existing);
    }

    // By employee
    const byEmployeeMap = new Map<string, { employee_name: string; department: string; days_by_type: Record<string, number> }>();
    for (const r of requests) {
      const empKey = r.user_id;
      const existing = byEmployeeMap.get(empKey) || {
        employee_name: r.user?.name || 'Unknown',
        department: (r.user as any)?.department?.label || 'Unknown',
        days_by_type: {},
      };
      const typeName = r.leaveType?.label || 'Unknown';
      existing.days_by_type[typeName] = (existing.days_by_type[typeName] || 0) + Number(r.working_days);
      byEmployeeMap.set(empKey, existing);
    }

    return {
      period: `${MONTH_NAMES[month]} ${year}`,
      summary: {
        total_days: totalDays,
        approved: approvedDays,
        declined: declinedDays,
        approval_rate_pct: approvalRatePct,
        sla_compliance_pct: slaCompliancePct,
      },
      by_type: Array.from(byTypeMap.values()),
      by_employee: Array.from(byEmployeeMap.values()),
      sla_performance: {
        within_sla: withinSla,
        escalated,
        breached: escalated,
      },
    };
  }

  async getYearlyReport(year: number, departmentId?: string) {
    const qb = this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.leaveType', 'lt')
      .leftJoinAndSelect('lr.user', 'u')
      .leftJoin('u.department', 'd')
      .addSelect(['d.id', 'd.label'])
      .where(`EXTRACT(YEAR FROM lr.start_date) = :year`, { year })
      .andWhere('lr.status != :cancelled', { cancelled: 'CANCELLED' });

    if (departmentId) {
      qb.andWhere('u.department_id = :departmentId', { departmentId });
    }

    const requests = await qb.getMany();

    const totalDays = requests.reduce((sum, r) => sum + Number(r.working_days), 0);
    const approved = requests.filter((r) => r.status === 'APPROVED');
    const declined = requests.filter((r) => r.status === 'DECLINED');
    const totalDecisions = approved.length + declined.length;
    const approvalRatePct = totalDecisions > 0 ? Math.round((approved.length / totalDecisions) * 100) : 0;

    // Monthly trend
    const monthlyTrend: { month: string; days: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthRequests = requests.filter(
        (r) => new Date(r.start_date).getMonth() + 1 === m,
      );
      monthlyTrend.push({
        month: MONTH_NAMES[m],
        days: monthRequests.reduce((sum, r) => sum + Number(r.working_days), 0),
      });
    }

    const approvedDays = approved.reduce((sum, r) => sum + Number(r.working_days), 0);
    const declinedDays = declined.reduce((sum, r) => sum + Number(r.working_days), 0);

    // SLA compliance for the year
    const slaApprovals = await this.leaveApprovalRepo
      .createQueryBuilder('la')
      .leftJoin('la.leaveRequest', 'lr')
      .leftJoin('lr.user', 'u')
      .where(`EXTRACT(YEAR FROM la.created_at) = :year`, { year })
      .andWhere('la.level = 1')
      .andWhere(departmentId ? 'u.department_id = :departmentId' : '1=1', { departmentId })
      .getMany();

    const withinSla = slaApprovals.filter((a) => !a.escalated).length;
    const slaCompliancePct = slaApprovals.length > 0 ? Math.round((withinSla / slaApprovals.length) * 100) : 100;

    // By type
    const byTypeMap = new Map<string, { leave_type: string; color: string; days: number }>();
    for (const r of requests) {
      const key = r.leaveType?.label || 'Unknown';
      const existing = byTypeMap.get(key) || { leave_type: key, color: r.leaveType?.color || '#6b7280', days: 0 };
      existing.days += Number(r.working_days);
      byTypeMap.set(key, existing);
    }

    // Per employee summary
    const byEmployeeMap = new Map<string, {
      employee_name: string;
      department: string;
      total_days: number;
      days_by_type: Record<string, number>;
    }>();
    for (const r of requests) {
      const empKey = r.user_id;
      const existing = byEmployeeMap.get(empKey) || {
        employee_name: r.user?.name || 'Unknown',
        department: (r.user as any)?.department?.label || 'Unknown',
        total_days: 0,
        days_by_type: {},
      };
      existing.total_days += Number(r.working_days);
      const typeName = r.leaveType?.label || 'Unknown';
      existing.days_by_type[typeName] = (existing.days_by_type[typeName] || 0) + Number(r.working_days);
      byEmployeeMap.set(empKey, existing);
    }

    return {
      period: String(year),
      summary: {
        total_days: totalDays,
        approved: approvedDays,
        declined: declinedDays,
        total_requests: requests.length,
        approval_rate_pct: approvalRatePct,
        sla_compliance_pct: slaCompliancePct,
      },
      by_type: Array.from(byTypeMap.values()),
      monthly_trend: monthlyTrend,
      by_employee: Array.from(byEmployeeMap.values()),
    };
  }

  async getLeaveBalanceReport(year: number, departmentId?: string) {
    const qb = this.leaveBalanceRepo
      .createQueryBuilder('lb')
      .leftJoinAndSelect('lb.user', 'u')
      .leftJoinAndSelect('lb.leaveType', 'lt')
      .leftJoin('u.department', 'd')
      .addSelect(['d.id', 'd.label'])
      .where('lb.year = :year', { year })
      .andWhere('u.is_active = true');

    if (departmentId) {
      qb.andWhere('u.department_id = :departmentId', { departmentId });
    }

    const balances = await qb.getMany();

    // Group by employee
    const byEmployeeMap = new Map<string, {
      employee_name: string;
      department: string;
      unused_leaves: { leave_type: string; total: number; used: number; available: number }[];
      total_unused_days: number;
    }>();

    for (const b of balances) {
      const available = Number(b.total_days) - Number(b.used_days) - Number(b.pending_days);
      if (available <= 0) continue;

      const empKey = b.user_id;
      const existing = byEmployeeMap.get(empKey) || {
        employee_name: b.user?.name || 'Unknown',
        department: (b.user as any)?.department?.label || 'Unknown',
        unused_leaves: [] as { leave_type: string; total: number; used: number; available: number }[],
        total_unused_days: 0,
      };

      existing.unused_leaves.push({
        leave_type: b.leaveType?.label || 'Unknown',
        total: Number(b.total_days),
        used: Number(b.used_days),
        available,
      });
      existing.total_unused_days += available;
      byEmployeeMap.set(empKey, existing);
    }

    return Array.from(byEmployeeMap.values()).sort((a, b) => b.total_unused_days - a.total_unused_days);
  }

  // ---- Export helpers ----

  generateMonthlyCsv(report: Awaited<ReturnType<typeof this.getMonthlyReport>>): string {
    const lines: string[] = [];
    lines.push('Employee,Department,Leave Type,Days');
    for (const emp of report.by_employee) {
      for (const [type, days] of Object.entries(emp.days_by_type)) {
        lines.push(`"${emp.employee_name}","${emp.department}","${type}",${days}`);
      }
    }
    lines.push('');
    lines.push(`Summary,Total Days,${report.summary.total_days}`);
    lines.push(`,Approved,${report.summary.approved}`);
    lines.push(`,Declined,${report.summary.declined}`);
    lines.push(`,Approval Rate,${report.summary.approval_rate_pct}%`);
    lines.push(`,SLA Compliance,${report.summary.sla_compliance_pct}%`);
    return lines.join('\n');
  }

  generateYearlyCsv(report: Awaited<ReturnType<typeof this.getYearlyReport>>): string {
    const lines: string[] = [];
    lines.push('Employee,Department,Leave Type,Days');
    for (const emp of report.by_employee) {
      for (const [type, days] of Object.entries(emp.days_by_type)) {
        lines.push(`"${emp.employee_name}","${emp.department}","${type}",${days}`);
      }
    }
    lines.push('');
    lines.push('Monthly Trend');
    lines.push('Month,Days');
    for (const m of report.monthly_trend) {
      lines.push(`${m.month},${m.days}`);
    }
    return lines.join('\n');
  }

  generateBalanceCsv(report: Awaited<ReturnType<typeof this.getLeaveBalanceReport>>): string {
    const lines: string[] = [];
    lines.push('Employee,Department,Leave Type,Total,Used,Available');
    for (const emp of report) {
      for (const leave of emp.unused_leaves) {
        lines.push(
          `"${emp.employee_name}","${emp.department}","${leave.leave_type}",${leave.total},${leave.used},${leave.available}`,
        );
      }
    }
    return lines.join('\n');
  }

  async generateMonthlyPdf(report: Awaited<ReturnType<typeof this.getMonthlyReport>>): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(`Monthly Leave Report — ${report.period}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Total Days: ${report.summary.total_days}`);
      doc.text(`Approved: ${report.summary.approved}`);
      doc.text(`Declined: ${report.summary.declined}`);
      doc.text(`Approval Rate: ${report.summary.approval_rate_pct}%`);
      doc.text(`SLA Compliance: ${report.summary.sla_compliance_pct}%`);
      doc.moveDown();

      doc.fontSize(14).text('By Leave Type', { underline: true });
      doc.fontSize(10);
      for (const t of report.by_type) {
        doc.text(`  ${t.leave_type}: ${t.days} days`);
      }
      doc.moveDown();

      doc.fontSize(14).text('By Employee', { underline: true });
      doc.fontSize(10);
      for (const emp of report.by_employee) {
        const types = Object.entries(emp.days_by_type)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        doc.text(`  ${emp.employee_name} (${emp.department}): ${types}`);
      }

      doc.end();
    });
  }

  async generateYearlyPdf(report: Awaited<ReturnType<typeof this.getYearlyReport>>): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;
    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(`Yearly Leave Report — ${report.period}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Total Requests: ${report.summary.total_requests ?? 0}`);
      doc.text(`Total Days: ${report.summary.total_days}`);
      doc.text(`Approval Rate: ${report.summary.approval_rate_pct}%`);
      doc.moveDown();

      doc.fontSize(14).text('Monthly Trend', { underline: true });
      doc.fontSize(10);
      for (const m of report.monthly_trend) {
        doc.text(`  ${m.month}: ${m.days} days`);
      }
      doc.moveDown();

      doc.fontSize(14).text('Per Employee Summary', { underline: true });
      doc.fontSize(10);
      for (const emp of report.by_employee) {
        const types = Object.entries(emp.days_by_type)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        doc.text(`  ${emp.employee_name} (${emp.department}): ${emp.total_days} total — ${types}`);
      }

      doc.end();
    });
  }
}
