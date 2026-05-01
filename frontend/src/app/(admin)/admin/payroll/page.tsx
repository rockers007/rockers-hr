'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import {
  PayrollRun,
  MONTHS,
  formatINR,
  stateLabel,
} from '@/lib/payroll-types';
import { formatDate } from '@/lib/utils';

export default function PayrollDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<PayrollRun[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBannerDismissed(
        window.localStorage.getItem('payroll-corrections-dismissed') === '1',
      );
    }
    (async () => {
      try {
        const data = await api.get<{ items: PayrollRun[]; total: number }>(
          '/payroll/runs?pageSize=10',
        );
        setRecent(data.items);
      } catch {
        // ignore — no runs yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dismissBanner = () => {
    window.localStorage.setItem('payroll-corrections-dismissed', '1');
    setBannerDismissed(true);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Payroll Dashboard
          </h1>
          <p className="text-sm text-text-secondary">
            Manage monthly payroll runs, master data, and reports.
          </p>
        </div>
        <Link href="/admin/payroll/runs/new">
          <Button>Start New Run</Button>
        </Link>
      </div>

      {!bannerDismissed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 text-sm text-amber-900">
              <p className="font-semibold">Key formulas (v2.2 updated)</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>PF = <code>basic ≥ 15,000 ? 1,800 : round(basic × 0.12)</code></li>
                <li>CTC = Gross + Employer PF + Incentive. Employer PF is in CTC only, not a deduction.</li>
                <li>OT rate = Gross ÷ 30 ÷ 9 × 1.5 (9-hour day).</li>
                <li>Sal for Calc = Gross − LWP deduction. The 7 components apply to SFC.</li>
                <li>ESIC scaffolded (3.25% + 0.75%, &lt;₹21,000 threshold) — inactive.</li>
              </ul>
              <button
                className="mt-2 text-xs underline"
                onClick={dismissBanner}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Recent Runs</h2>
          <Link href="/admin/payroll/runs" className="text-sm text-accent hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No payroll runs yet.{' '}
            <Link href="/admin/payroll/runs/new" className="text-accent hover:underline">
              Start the first one
            </Link>
            .
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">State</th>
                <th className="px-6 py-3">Employees</th>
                <th className="px-6 py-3">Net Payable</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.map((r) => {
                const st = stateLabel(r.state);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-text-primary">
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
                      {formatDate(r.created_at)}
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
