'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { formatDateRange } from '@/lib/utils';
import type { LeaveRequest, LeaveStatus } from '@/lib/types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING_L1,PENDING_L2' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Declined', value: 'DECLINED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function MyLeavesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), limit: '50' });
    if (filter) params.set('status', filter);
    api.get<LeaveRequest[]>(`/leave/requests?${params}`)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [filter, year]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Leaves</h1>
        <Link href="/apply">
          <Button>+ Apply Leave</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-border px-3 py-1.5 text-sm bg-white"
        >
          {[0, 1, 2].map((offset) => {
            const y = new Date().getFullYear() - offset;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {loading ? (
        <PageLoader />
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            title="No leave requests"
            description="Apply for your first leave to get started."
            action={
              <Link href="/apply">
                <Button variant="secondary" size="sm">Apply for Leave</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link key={req.id} href={`/my-leaves/${req.id}`}>
              <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: req.leave_type.color }}
                    />
                    <div>
                      <p className="font-medium text-text-primary">{req.leave_type.label}</p>
                      <p className="text-sm text-text-secondary">
                        {formatDateRange(req.start_date, req.end_date)} &middot; {req.working_days} day{req.working_days !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
