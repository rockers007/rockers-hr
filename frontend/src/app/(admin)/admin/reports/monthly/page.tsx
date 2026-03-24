'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useMasterData } from '@/lib/master-data';

interface MonthlyReportSummary {
  total_days: number;
  approved: number;
  declined: number;
  approval_rate_pct: number;
  sla_compliance_pct: number;
}

interface LeaveTypeBreakdown {
  leave_type: string;
  color: string;
  days: number;
}

interface EmployeeBreakdown {
  employee_name: string;
  department: string;
  days_by_type: Record<string, number>;
}

interface SlaPerformance {
  within_sla: number;
  escalated: number;
  breached: number;
}

interface MonthlyReport {
  period: string;
  summary: MonthlyReportSummary;
  by_type: LeaveTypeBreakdown[];
  by_employee: EmployeeBreakdown[];
  sla_performance: SlaPerformance;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 3;

export default function MonthlyReportPage() {
  const { data: masterData } = useMasterData();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [departmentId, setDepartmentId] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      if (departmentId) params.set('department_id', departmentId);
      const data = await api.get<MonthlyReport>(`/admin/reports/monthly?${params}`);
      setReport(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load monthly report';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [month, year, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(format);
      const params = new URLSearchParams({
        format,
        month: String(month),
        year: String(year),
      });
      if (departmentId) params.set('department_id', departmentId);
      const url = `/api/v1/admin/reports/monthly/export?${params}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `monthly-report-${year}-${String(month).padStart(2, '0')}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  const maxDays = report ? Math.max(...report.by_type.map((t) => t.days), 1) : 1;
  const slaTotal = report
    ? report.sla_performance.within_sla + report.sla_performance.escalated + report.sla_performance.breached
    : 0;
  const allLeaveTypes = report ? report.by_type.map((t) => t.leave_type) : [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Monthly Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            isLoading={exporting === 'csv'}
            disabled={!report || exporting !== null}
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isLoading={exporting === 'pdf'}
            disabled={!report || exporting !== null}
            onClick={() => handleExport('pdf')}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Month</label>
            <select
              className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Year</label>
            <select
              className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Department</label>
            <select
              className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {masterData.departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading && <PageLoader />}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-danger mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchReport}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && !report && (
        <EmptyState
          title="No data available"
          description="No leave data found for the selected period."
        />
      )}

      {!loading && !error && report && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card>
              <p className="text-sm text-text-secondary">Total Days</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{report.summary.total_days}</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Approved</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{report.summary.approved}</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Declined</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{report.summary.declined}</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">Approval Rate</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{report.summary.approval_rate_pct}%</p>
            </Card>
            <Card>
              <p className="text-sm text-text-secondary">SLA Compliance</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{report.summary.sla_compliance_pct}%</p>
            </Card>
          </div>

          {/* By Leave Type */}
          <Card>
            <CardTitle>By Leave Type</CardTitle>
            {report.by_type.length === 0 ? (
              <p className="text-sm text-text-secondary">No leave type data for this period.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {report.by_type.map((item) => (
                  <div key={item.leave_type} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm text-text-primary truncate">{item.leave_type}</span>
                    <div className="flex-1 h-6 rounded-full bg-neutral-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.days / maxDays) * 100}%`,
                          backgroundColor: item.color,
                          minWidth: item.days > 0 ? '1.5rem' : '0',
                        }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-medium text-text-primary">
                      {item.days}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* SLA Performance */}
          <Card>
            <CardTitle>SLA Performance</CardTitle>
            {slaTotal === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No SLA data for this period.</p>
            ) : (
              <div className="mt-4">
                <div className="flex h-8 overflow-hidden rounded-full">
                  {report.sla_performance.within_sla > 0 && (
                    <div
                      className="flex items-center justify-center text-xs font-medium text-white bg-green-500"
                      style={{ width: `${(report.sla_performance.within_sla / slaTotal) * 100}%` }}
                    >
                      {report.sla_performance.within_sla}
                    </div>
                  )}
                  {report.sla_performance.escalated > 0 && (
                    <div
                      className="flex items-center justify-center text-xs font-medium text-white bg-yellow-500"
                      style={{ width: `${(report.sla_performance.escalated / slaTotal) * 100}%` }}
                    >
                      {report.sla_performance.escalated}
                    </div>
                  )}
                  {report.sla_performance.breached > 0 && (
                    <div
                      className="flex items-center justify-center text-xs font-medium text-white bg-red-500"
                      style={{ width: `${(report.sla_performance.breached / slaTotal) * 100}%` }}
                    >
                      {report.sla_performance.breached}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-text-secondary">Within SLA ({report.sla_performance.within_sla})</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-text-secondary">Escalated ({report.sla_performance.escalated})</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-text-secondary">Breached ({report.sla_performance.breached})</span>
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* By Employee Table */}
          <Card>
            <CardTitle>By Employee</CardTitle>
            {report.by_employee.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No employee data for this period.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 text-left font-medium text-text-secondary">Employee</th>
                      <th className="pb-2 pr-4 text-left font-medium text-text-secondary">Department</th>
                      {allLeaveTypes.map((lt) => (
                        <th key={lt} className="pb-2 pr-4 text-right font-medium text-text-secondary">
                          {lt}
                        </th>
                      ))}
                      <th className="pb-2 text-right font-medium text-text-secondary">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_employee.map((emp) => {
                      const total = Object.values(emp.days_by_type).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={emp.employee_name} className="border-b border-border last:border-0">
                          <td className="py-2 pr-4 text-text-primary font-medium">{emp.employee_name}</td>
                          <td className="py-2 pr-4 text-text-secondary">{emp.department}</td>
                          {allLeaveTypes.map((lt) => (
                            <td key={lt} className="py-2 pr-4 text-right text-text-primary">
                              {emp.days_by_type[lt] ?? 0}
                            </td>
                          ))}
                          <td className="py-2 text-right font-semibold text-text-primary">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
