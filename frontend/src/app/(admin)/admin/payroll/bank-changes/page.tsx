'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { BankChangeRequest } from '@/lib/payroll-types';
import { formatDateTime } from '@/lib/utils';

type StatusFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function BankChangesAdminPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BankChangeRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('PENDING');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = filter ? `?status=${filter}` : '';
      const data = await api.get<BankChangeRequest[]>(
        `/payroll/bank-change${params}`,
      );
      setRows(data);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    if (!window.confirm('Approve this bank change?')) return;
    try {
      await api.post(`/payroll/bank-change/${id}/approve`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Rejection reason (required):');
    if (!reason?.trim()) return;
    try {
      await api.post(`/payroll/bank-change/${id}/reject`, {
        rejection_reason: reason,
      });
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bank Change Requests</h1>
        <p className="text-sm text-text-secondary">
          Review and approve employee-submitted bank detail changes.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Status:</span>
          {(['PENDING', 'APPROVED', 'REJECTED', ''] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === s
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No requests match this filter.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">New</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatDateTime(r.submitted_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.current_bank_name ?? '—'}</div>
                    <div className="text-xs text-text-secondary">
                      {r.current_account_no ?? '—'} · {r.current_ifsc ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.new_bank_name}</div>
                    <div className="text-xs text-text-secondary">
                      {r.new_account_no} · {r.new_ifsc}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        <Button variant="danger" size="sm" onClick={() => reject(r.id)}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => approve(r.id)}>
                          Approve
                        </Button>
                      </div>
                    )}
                    {r.status === 'REJECTED' && r.rejection_reason && (
                      <div className="text-xs text-text-secondary italic">
                        {r.rejection_reason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  } as const;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}
