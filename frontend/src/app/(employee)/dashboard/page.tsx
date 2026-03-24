'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDateRange, getInitials } from '@/lib/utils';
import type { LeaveBalance, LeaveRequest, LeaveStatus } from '@/lib/types';

interface TeamMember {
  name: string;
  leave_type: string;
  color: string;
  start_date: string;
  end_date: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [activeRequests, setActiveRequests] = useState<LeaveRequest[]>([]);
  const [teamOnLeave, setTeamOnLeave] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bal, requests] = await Promise.all([
          api.get<LeaveBalance[]>('/leave/balance'),
          api.get<LeaveRequest[]>('/leave/requests?status=PENDING_L1,PENDING_L2&limit=5'),
        ]);
        setBalances(bal);
        setActiveRequests(requests);

        // Team on leave is optional — may not be implemented yet
        try {
          const team = await api.get<TeamMember[]>('/leave/team-on-leave');
          setTeamOnLeave(team);
        } catch {
          // Endpoint may not exist yet
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Hi, {user?.name?.split(' ')[0]}
        </h1>
        <Link href="/apply">
          <Button size="lg">+ Apply for Leave</Button>
        </Link>
      </div>

      {/* Leave Balance Cards */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Leave Balance
        </h2>
        {balances.length === 0 ? (
          <Card>
            <EmptyState title="No leave balances" description="Balances will appear after account activation." />
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {balances.map((b) => {
              const pct = b.total_days > 0 ? (b.available_days / b.total_days) * 100 : 0;
              return (
                <Card key={b.leave_type.id} className="relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: b.leave_type.color }}
                  />
                  <div className="pl-3">
                    <p className="text-sm font-medium text-text-secondary">{b.leave_type.label}</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-text-primary">{b.available_days}</span>
                      <span className="text-sm text-text-secondary">/ {b.total_days}</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: b.leave_type.color }}
                      />
                    </div>
                    {b.pending_days > 0 && (
                      <p className="mt-1 text-xs text-warning">{b.pending_days}d pending</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Requests */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Active Requests
        </h2>
        {activeRequests.length === 0 ? (
          <Card>
            <EmptyState
              title="No active requests"
              description="Your pending leave requests will appear here."
              action={
                <Link href="/apply">
                  <Button variant="secondary" size="sm">Apply for Leave</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {activeRequests.map((req) => (
              <Link key={req.id} href={`/my-leaves/${req.id}`}>
                <Card className="hover:border-accent/30 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-1 rounded-full"
                        style={{ backgroundColor: req.leave_type.color }}
                      />
                      <div>
                        <p className="font-medium text-text-primary">{req.leave_type.label}</p>
                        <p className="text-sm text-text-secondary">
                          {formatDateRange(req.start_date, req.end_date)} &middot; {req.working_days} day{req.working_days !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={req.status} />
                      <ApprovalTimeline status={req.status} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Team on Leave Today */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Team on Leave Today
        </h2>
        {teamOnLeave.length === 0 ? (
          <Card>
            <EmptyState title="Everyone is in today!" />
          </Card>
        ) : (
          <Card>
            <div className="space-y-3">
              {teamOnLeave.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-medium">
                    {getInitials(m.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{m.name}</p>
                    <p className="text-xs text-text-secondary">
                      {m.leave_type} &middot; {formatDateRange(m.start_date, m.end_date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function ApprovalTimeline({ status }: { status: LeaveStatus }) {
  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Manager', done: status !== 'PENDING_L1' },
    { label: 'HR', done: status === 'APPROVED' },
  ];

  return (
    <div className="hidden sm:flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`h-2 w-2 rounded-full ${
              step.done ? 'bg-success' : 'bg-gray-300'
            }`}
          />
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-4 ${step.done ? 'bg-success' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
