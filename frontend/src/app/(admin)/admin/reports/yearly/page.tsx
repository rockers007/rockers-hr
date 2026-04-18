'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useMasterData } from '@/lib/master-data';

interface YearlySummary {
  total_days: number;
  approved: number;
  declined: number;
  approval_rate_pct: number;
  sla_compliance_pct: number;
}

interface MonthlyTrend {
  month: string;
  days: number;
}

interface EmployeeSummary {
  employee_name: string;
  department: string;
  total_days: number;
  days_by_type: Record<string, number>;
}

interface LeaveTypeBreakdown {
  leave_type: string;
  color: string;
  days: number;
}

interface YearlyReport {
  period: string;
  summary: YearlySummary;
  by_type: LeaveTypeBreakdown[];
  monthly_trend: MonthlyTrend[];
  by_employee: EmployeeSummary[];
}

const CURRENT_YEAR = 2026;

export default function YearlyReportPage() {
  const { data: masterData } = useMasterData();
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [departmentId, setDepartmentId] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ year: String(year) });
      if (departmentId) params.set('department_id', departmentId);
      const data = await api.get<YearlyReport>(`/admin/reports/yearly?${params}`);
      setReport(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load yearly report';
      setError(message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [year, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setExporting(format);
      const params = new URLSearchParams({ format, year: String(year) });
      if (departmentId) params.set('department_id', departmentId);
      const url = `/api/v1/admin/reports/yearly/export?${params}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yearly-report-${year}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  const maxTrendDays = report
    ? Math.max(...report.monthly_trend.map((m) => m.days), 1)
    : 1;
  const maxTypeDays = report
    ? Math.max(...report.by_type.map((t) => t.days), 1)
    : 1;
  const allLeaveTypes = report ? report.by_type.map((t) => t.leave_type) : [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Yearly Report</h1>
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
          description="No leave data found for the selected year."
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

          {/* Monthly Trend */}
          <Card>
            <CardTitle>Monthly Trend</CardTitle>
            {report.monthly_trend.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No monthly trend data available.</p>
            ) : (
              <div className="mt-4 flex items-end gap-2" style={{ height: '12rem' }}>
                {report.monthly_trend.map((item) => {
                  const heightPct = maxTrendDays > 0 ? (item.days / maxTrendDays) * 100 : 0;
                  return (
                    <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium text-text-primary">{item.days}</span>
                      <div className="w-full flex items-end" style={{ height: '9rem' }}>
                        <div
                          className="w-full rounded-t bg-blue-500 transition-all"
                          style={{
                            height: `${heightPct}%`,
                            minHeight: item.days > 0 ? '0.25rem' : '0',
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary truncate w-full text-center">
                        {item.month.substring(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* By Leave Type */}
          <Card>
            <CardTitle>By Leave Type</CardTitle>
            {report.by_type.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No leave type data for this year.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {report.by_type.map((item) => (
                  <div key={item.leave_type} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-sm text-text-primary truncate">{item.leave_type}</span>
                    <div className="flex-1 h-6 rounded-full bg-neutral-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.days / maxTypeDays) * 100}%`,
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

          {/* Employee Summary Table */}
          <Card>
            <CardTitle>Employee Summary</CardTitle>
            {report.by_employee.length === 0 ? (
              <p className="mt-2 text-sm text-text-secondary">No employee data for this year.</p>
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
                    {report.by_employee.map((emp) => (
                      <tr key={emp.employee_name} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 text-text-primary font-medium">{emp.employee_name}</td>
                        <td className="py-2 pr-4 text-text-secondary">{emp.department}</td>
                        {allLeaveTypes.map((lt) => (
                          <td key={lt} className="py-2 pr-4 text-right text-text-primary">
                            {emp.days_by_type[lt] ?? 0}
                          </td>
                        ))}
                        <td className="py-2 text-right font-semibold text-text-primary">{emp.total_days}</td>
                      </tr>
                    ))}
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
