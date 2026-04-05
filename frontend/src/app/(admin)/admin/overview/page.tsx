'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDateRange } from '@/lib/utils';
import type { LeaveRequest } from '@/lib/types';

interface AdminLeaveRequest extends LeaveRequest {
  employee?: { id: string; name: string; email: string };
  user?: { id: string; name: string; gmail: string };
}

interface PendingApproval {
  id: string;
  leave_request_id: string;
  level: number;
  action: string | null;
  leave_request: AdminLeaveRequest;
}

/** Normalize approval objects into flat leave request shape for display */
function normalizePending(items: any[]): AdminLeaveRequest[] {
  return items.map((item) => {
    // If it's an approval wrapper, unwrap the leave_request
    if (item.leave_request) {
      const lr = item.leave_request;
      return {
        ...lr,
        approval_id: item.id,
        employee: lr.user ? { id: lr.user.id, name: lr.user.name, email: lr.user.gmail } : lr.employee,
      } as AdminLeaveRequest;
    }
    return item as AdminLeaveRequest;
  });
}

interface Stats {
  pendingCount: number;
  totalEmployees: string;
  leavesToday: string;
  slaCompliance: string;
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    pendingCount: 0,
    totalEmployees: '\u2014',
    leavesToday: '\u2014',
    slaCompliance: '\u2014',
  });
  const [pendingApprovals, setPendingApprovals] = useState<AdminLeaveRequest[]>([]);
  const [recentRequests, setRecentRequests] = useState<AdminLeaveRequest[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const results = await Promise.allSettled([
          api.get<AdminLeaveRequest[]>('/admin/approvals/pending'),
          api.get<{ data: AdminLeaveRequest[]; meta: { total: number } }>('/admin/leave/requests?limit=10'),
          api.get<{ data: unknown[]; meta: { total: number } }>('/admin/users?limit=1'),
        ]);

        // Pending approvals
        if (results[0].status === 'fulfilled') {
          const pending = results[0].value;
          const rawList = Array.isArray(pending) ? pending : [];
          const list = normalizePending(rawList);
          setPendingApprovals(list.slice(0, 5));
          setStats((s) => ({ ...s, pendingCount: list.length }));
        }

        // Recent leave requests
        if (results[1].status === 'fulfilled') {
          const raw = results[1].value;
          // Handle both paginated { data, meta } and plain array responses
          const rawList = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
          // Normalize user → employee field
          const list = rawList.map((r: any) => ({
            ...r,
            employee: r.employee ?? (r.user ? { id: r.user.id, name: r.user.name, email: r.user.gmail } : undefined),
          }));
          setRecentRequests(list);
        }

        // Total employees
        if (results[2].status === 'fulfilled') {
          const raw = results[2].value;
          const total = (raw as { meta?: { total?: number } })?.meta?.total;
          if (typeof total === 'number') {
            setStats((s) => ({ ...s, totalEmployees: String(total) }));
          }
        }
      } catch {
        // individual errors already handled by allSettled
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Overview</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Dashboard summary for HR administration
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#dbeafe]">
            <svg className="h-6 w-6 text-[#1e40af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-bold text-text-primary">{stats.pendingCount}</p>
            <p className="text-sm text-text-secondary">Pending Approvals</p>
          </div>
        </Card>

        <Card className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#d1fae5]">
            <svg className="h-6 w-6 text-[#065f46]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.972 5.972 0 00-.786-3.07M9 19.128A5.972 5.972 0 008.214 16.058M9 19.128H3.375a1.125 1.125 0 01-1.125-1.125v-.003c0-1.62.934-3.108 2.456-3.87a7.5 7.5 0 0110.588 0c1.522.762 2.456 2.25 2.456 3.87M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-bold text-text-primary">{stats.totalEmployees}</p>
            <p className="text-sm text-text-secondary">Total Employees</p>
          </div>
        </Card>

        <Card className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#fef3c7]">
            <svg className="h-6 w-6 text-[#92400e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-bold text-text-primary">{stats.leavesToday}</p>
            <p className="text-sm text-text-secondary">Leaves Today</p>
          </div>
        </Card>

        <Card className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ede9fe]">
            <svg className="h-6 w-6 text-[#5b21b6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <p className="text-3xl font-bold text-text-primary">{stats.slaCompliance}</p>
            <p className="text-sm text-text-secondary">SLA Compliance</p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/approvals">
          <Button variant="primary" size="sm">View All Approvals</Button>
        </Link>
        <Link href="/admin/employees">
          <Button variant="secondary" size="sm">View Employees</Button>
        </Link>
        <Link href="/admin/registrations">
          <Button variant="secondary" size="sm">Registrations</Button>
        </Link>
        <Link href="/admin/reports">
          <Button variant="secondary" size="sm">Reports</Button>
        </Link>
      </div>

      {/* Pending Approvals Section */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Pending Approvals</CardTitle>
          {pendingApprovals.length > 0 && (
            <Link href="/admin/approvals" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          )}
        </div>

        {pendingApprovals.length === 0 ? (
          <EmptyState
            title="No pending approvals"
            description="All leave requests have been reviewed."
          />
        ) : (
          <div className="divide-y divide-border">
            {pendingApprovals.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">
                    {req.employee?.name ?? 'Unknown Employee'}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {req.leave_type?.label ?? 'Leave'} &middot; {formatDateRange(req.start_date, req.end_date)}
                    {req.working_days > 0 && (
                      <span className="ml-1">
                        ({req.working_days} day{req.working_days !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={req.status} />
                  <Link href={`/admin/approvals`}>
                    <Button variant="primary" size="sm">Review</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Leave Requests Section */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Recent Leave Requests</CardTitle>
          <Link href="/admin/approvals" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <EmptyState
            title="No leave requests"
            description="No leave requests have been submitted yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-3 pr-4 font-medium">Employee</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Dates</th>
                  <th className="pb-3 pr-4 font-medium">Days</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentRequests.map((req) => (
                  <tr key={req.id} className="text-text-primary">
                    <td className="py-3 pr-4">
                      <span className="font-medium">{req.employee?.name ?? 'Unknown'}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="inline-flex items-center gap-1.5"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: req.leave_type?.color || '#6b7280' }}
                        />
                        {req.leave_type?.label ?? 'Leave'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatDateRange(req.start_date, req.end_date)}
                    </td>
                    <td className="py-3 pr-4">{req.working_days}</td>
                    <td className="py-3">
                      <StatusBadge status={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
