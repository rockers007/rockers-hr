'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/spinner';
import { formatDate, getInitials } from '@/lib/utils';
import type { LeaveBalance } from '@/lib/types';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  useEffect(() => {
    api.get<LeaveBalance[]>('/leave/balance')
      .then(setBalances)
      .catch(() => {})
      .finally(() => setBalancesLoading(false));
  }, []);

  if (!user) return <PageLoader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Profile</h1>

      {/* Top Section — Avatar, Name, Email, Role */}
      <Card className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex-shrink-0">
          {user.photo_url ? (
            <img
              src={user.photo_url}
              alt={user.name}
              className="h-24 w-24 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white">
              {getInitials(user.name)}
            </div>
          )}
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-semibold text-text-primary">{user.name}</h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">
            {user.role}
          </span>
        </div>
      </Card>

      {/* Info Grid */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Personal Information</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem label="Phone" value={user.phone || '—'} />
          <InfoItem label="Department" value={user.department?.label || '—'} />
          <InfoItem label="Manager" value={user.manager?.name || '—'} />
          <InfoItem label="Join Date" value={user.join_date ? formatDate(user.join_date) : '—'} />
          <InfoItem
            label="Confirmation Date"
            value={user.confirmation_date ? formatDate(user.confirmation_date) : '—'}
          />
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Probation Status</p>
            {user.is_in_probation ? (
              <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                In Probation
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-xs font-medium text-[#065f46]">
                Confirmed
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Leave Balance Summary */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Leave Balance Summary</h3>
        {balancesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : balances.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">
            No leave balances available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => (
              <div
                key={b.leave_type.id}
                className="flex items-center justify-between rounded-lg border border-border bg-neutral-bg px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: b.leave_type.color }}
                  />
                  <span className="text-sm font-medium text-text-primary">
                    {b.leave_type.label}
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{b.available_days}</span>
                  {' / '}
                  {b.total_days}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary">{value}</p>
    </div>
  );
}
