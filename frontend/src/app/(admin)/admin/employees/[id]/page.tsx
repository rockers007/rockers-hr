'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDate, formatDateRange, getInitials } from '@/lib/utils';
import type { LeaveBalance, LeaveRequest } from '@/lib/types';

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo_url: string | null;
  department: { id: string; label: string } | null;
  role: string;
  join_date: string;
  confirmation_date: string | null;
  is_in_probation: boolean;
  is_active: boolean;
  manager: { id: string; name: string } | null;
  qualification: { id: string; label: string } | null;
  gender: { id: string; label: string } | null;
  leave_balances: LeaveBalance[];
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [emp, leaves] = await Promise.all([
          api.get<EmployeeProfile>(`/admin/users/${id}`),
          api.get<LeaveRequest[]>(`/admin/leave/requests?user_id=${id}&limit=10`),
        ]);
        setEmployee(emp);
        setRecentLeaves(leaves);
      } catch {
        setError('Failed to load employee details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <PageLoader />;

  if (error || !employee) {
    return (
      <Card>
        <EmptyState
          title="Employee not found"
          description={error || 'The requested employee could not be loaded.'}
          action={
            <Link href="/admin/employees">
              <Button variant="secondary" size="sm">Back to Employees</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const balances = employee.leave_balances ?? [];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Employees
      </Link>

      {/* Profile Header */}
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {employee.photo_url ? (
              <img
                src={employee.photo_url}
                alt={employee.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent text-xl font-semibold">
                {getInitials(employee.name)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-text-primary">{employee.name}</h1>
              <p className="text-sm text-text-secondary">{employee.email}</p>
              {employee.phone && (
                <p className="text-sm text-text-secondary">{employee.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                employee.is_active
                  ? 'bg-[#d1fae5] text-[#065f46]'
                  : 'bg-[#f1f5f9] text-[#475569]'
              }`}
            >
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
            {employee.is_in_probation && (
              <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                Probation
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label="Department" value={employee.department?.label ?? '-'} />
          <InfoItem label="Role" value={employee.role} />
          <InfoItem label="Join Date" value={formatDate(employee.join_date)} />
          <InfoItem
            label="Manager"
            value={employee.manager?.name ?? 'No manager assigned'}
          />
          {employee.confirmation_date && (
            <InfoItem label="Confirmation Date" value={formatDate(employee.confirmation_date)} />
          )}
          {employee.qualification && (
            <InfoItem label="Qualification" value={employee.qualification.label} />
          )}
          {employee.gender && (
            <InfoItem label="Gender" value={employee.gender.label} />
          )}
        </div>
      </Card>

      {/* Leave Balance Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Leave Balance</h2>
          <Link href={`/admin/employees/${id}/apply`}>
            <Button size="sm">Submit Leave on Behalf</Button>
          </Link>
        </div>

        {balances.length === 0 ? (
          <Card>
            <EmptyState
              title="No leave balances"
              description="Leave balances will appear once the employee is confirmed."
            />
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((bal) => (
              <Card key={bal.leave_type.id} className="relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-1 w-full"
                  style={{ backgroundColor: bal.leave_type.color }}
                />
                <div className="pt-2">
                  <p className="text-sm font-medium text-text-primary">
                    {bal.leave_type.label}
                  </p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-2xl font-bold text-text-primary">
                      {bal.available_days}
                    </span>
                    <span className="text-sm text-text-secondary mb-0.5">
                      / {bal.total_days} days
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((bal.used_days + bal.pending_days) / bal.total_days) * 100)}%`,
                        backgroundColor: bal.leave_type.color,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-text-secondary">
                    <span>Used: {bal.used_days}d</span>
                    <span>Pending: {bal.pending_days}d</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Leaves */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Leave Requests</h2>

        {recentLeaves.length === 0 ? (
          <Card>
            <EmptyState
              title="No leave requests"
              description="This employee has not submitted any leave requests yet."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {recentLeaves.map((req) => (
              <Card key={req.id} className="hover:border-accent/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: req.leave_type.color }}
                    />
                    <div>
                      <p className="font-medium text-text-primary">
                        {req.leave_type.label}
                        {req.duration_type && (
                          <span className="ml-2 text-xs text-text-secondary font-normal">
                            ({req.duration_type.label})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {formatDateRange(req.start_date, req.end_date)} &middot;{' '}
                        {req.working_days} day{req.working_days !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {req.submitted_by_admin && (
                      <span className="text-xs text-text-secondary bg-neutral-bg rounded px-2 py-0.5">
                        by {req.submitted_by_admin.name}
                      </span>
                    )}
                    <StatusBadge status={req.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text-primary capitalize">{value}</p>
    </div>
  );
}
