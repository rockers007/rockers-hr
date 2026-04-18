'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import type { LeaveBalance } from '@/lib/types';

export default function BalancePage() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LeaveBalance[]>('/leave/balance')
      .then(setBalances)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Leave Balance</h1>

      {balances.length === 0 ? (
        <Card>
          <EmptyState title="No leave balances" description="Balances will appear after account activation." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((b) => {
            const pct = b.total_days > 0 ? (b.available_days / b.total_days) * 100 : 0;
            const usedPct = b.total_days > 0 ? (b.used_days / b.total_days) * 100 : 0;
            return (
              <Card key={b.leave_type.id}>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: b.leave_type.color }}
                  />
                  <h3 className="font-semibold text-text-primary">{b.leave_type.label}</h3>
                </div>

                {/* Circular progress */}
                <div className="flex items-center gap-6">
                  <div className="relative h-20 w-20 flex-shrink-0">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={b.leave_type.color}
                        strokeWidth="3"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-text-primary">{b.available_days}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm flex-1">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Total</span>
                      <span className="font-medium">{b.total_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Used</span>
                      <span className="font-medium">{b.used_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Pending</span>
                      <span className="font-medium text-warning">{b.pending_days} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Available</span>
                      <span className="font-bold text-success">{b.available_days} days</span>
                    </div>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="mt-4">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="h-full"
                        style={{ width: `${usedPct}%`, backgroundColor: b.leave_type.color }}
                      />
                      {b.pending_days > 0 && (
                        <div
                          className="h-full bg-warning"
                          style={{ width: `${(b.pending_days / b.total_days) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
