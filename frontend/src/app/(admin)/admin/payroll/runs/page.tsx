'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import {
  PayrollRun,
  PayrollRunState,
  MONTHS,
  formatINR,
  stateLabel,
} from '@/lib/payroll-types';
import { formatDate } from '@/lib/utils';

export default function RunsListPage() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [filter, setFilter] = useState<PayrollRunState | ''>('');
  const [year, setYear] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filter) params.set('state', filter);
        if (year) params.set('year', year);
        params.set('pageSize', '50');
        const data = await api.get<{ items: PayrollRun[] }>(
          `/payroll/runs?${params.toString()}`,
        );
        setRuns(data.items);
      } finally {
        setLoading(false);
      }
    })();
  }, [filter, year]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Runs</h1>
          <p className="text-sm text-text-secondary">
            All monthly payroll runs past and present.
          </p>
        </div>
        <Link href="/admin/payroll/runs/new">
          <Button>New Run</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-text-secondary">
              State
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as PayrollRunState)}
              className="mt-1 rounded border border-border bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Under Review</option>
              <option value="LOCKED">Locked</option>
              <option value="RELEASED">Released</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-text-secondary">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Any"
              className="mt-1 w-24 rounded border border-border bg-white px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <PageLoader />
        ) : runs.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No runs match the filter.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">State</th>
                <th className="px-6 py-3">Employees</th>
                <th className="px-6 py-3">Net Payable</th>
                <th className="px-6 py-3">Released</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => {
                const st = stateLabel(r.state);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">
                      {MONTHS[r.month - 1]} {r.year}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-3">{r.total_employees}</td>
                    <td className="px-6 py-3">{formatINR(r.total_net_payable)}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">
                      {r.released_at
                        ? formatDate(r.released_at)
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/admin/payroll/runs/${r.id}`}
                        className="text-sm text-accent hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
