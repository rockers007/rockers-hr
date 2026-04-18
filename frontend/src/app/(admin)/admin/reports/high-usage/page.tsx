'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useMasterData } from '@/lib/master-data';

interface UnusedLeave {
  leave_type: string;
  total: number;
  used: number;
  available: number;
}

interface LeaveBalanceEntry {
  employee_name: string;
  department: string;
  unused_leaves: UnusedLeave[];
  total_unused_days: number;
}

const CURRENT_YEAR = 2026;

export default function HighUsagePage() {
  const { data: masterData } = useMasterData();
  const [entries, setEntries] = useState<LeaveBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [departmentId, setDepartmentId] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ year: String(year) });
      if (departmentId) params.set('department_id', departmentId);
      const data = await api.get<LeaveBalanceEntry[]>(`/admin/reports/leave-balance?${params}`);
      setEntries(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load leave balance report';
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [year, departmentId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ format: 'csv', year: String(year) });
      if (departmentId) params.set('department_id', departmentId);
      const url = `/api/v1/admin/reports/leave-balance/export?${params}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leave-balance-${year}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Collect all unique leave types across all entries for table columns
  const allLeaveTypes = Array.from(
    new Set(entries.flatMap((e) => e.unused_leaves.map((ul) => ul.leave_type))),
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Leave Balance Report</h1>
        <Button
          variant="secondary"
          size="sm"
          isLoading={exporting}
          disabled={entries.length === 0 || exporting}
          onClick={handleExport}
        >
          Export CSV
        </Button>
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

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          title="No data available"
          description="No leave balance data found for the selected filters."
        />
      )}

      {!loading && !error && entries.length > 0 && (
        <Card>
          <CardTitle>Employee Leave Balances</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-left font-medium text-text-secondary">Employee</th>
                  <th className="pb-2 pr-4 text-left font-medium text-text-secondary">Department</th>
                  {allLeaveTypes.map((lt) => (
                    <th key={lt} className="pb-2 pr-4 text-center font-medium text-text-secondary">
                      {lt}
                    </th>
                  ))}
                  <th className="pb-2 text-right font-medium text-text-secondary">Total Unused</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isHighUnused = entry.total_unused_days > 5;
                  const rowClass = isHighUnused
                    ? 'border-b border-border last:border-0 bg-amber-50'
                    : 'border-b border-border last:border-0';

                  // Build a lookup for this employee's leave types
                  const leaveMap = new Map(
                    entry.unused_leaves.map((ul) => [ul.leave_type, ul]),
                  );

                  return (
                    <tr key={entry.employee_name} className={rowClass}>
                      <td className="py-2 pr-4 text-text-primary font-medium">{entry.employee_name}</td>
                      <td className="py-2 pr-4 text-text-secondary">{entry.department}</td>
                      {allLeaveTypes.map((lt) => {
                        const leave = leaveMap.get(lt);
                        if (!leave) {
                          return (
                            <td key={lt} className="py-2 pr-4 text-center text-text-secondary">
                              --
                            </td>
                          );
                        }
                        return (
                          <td key={lt} className="py-2 pr-4 text-center text-text-primary">
                            <span className="text-text-secondary">{leave.used}</span>
                            <span className="text-text-secondary">/</span>
                            <span>{leave.total}</span>
                          </td>
                        );
                      })}
                      <td className="py-2 text-right font-semibold text-text-primary">
                        {isHighUnused ? (
                          <span className="text-amber-700">{entry.total_unused_days}</span>
                        ) : (
                          entry.total_unused_days
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
