'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/spinner';
import { formatINR, type PayrollSalary } from '@/lib/payroll-types';
import { SalaryBreakdownTable } from '@/components/payroll/salary-breakdown-table';

/**
 * Employee-facing salary breakdown. Shows the same per-component
 * structure that admins see on the right panel of
 * /admin/payroll/employees/:userId/salary, and that the actual payslip
 * uses, but read-only — employees can't change any of these numbers.
 *
 * Data source: /payroll/me/salary which calls
 * SalaryService.getSalary(userId, includePreview=true). The
 * `computed_preview` field on the response is shaped exactly like
 * the admin live-preview, so we can reuse SalaryBreakdownTable
 * unchanged.
 *
 * The preview assumes 0 LWP and 0 OT — the actual payslip is the
 * authoritative number once a run releases.
 */

export default function EmployeeSalaryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PayrollSalary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<PayrollSalary>('/payroll/me/salary');
        setData(d);
      } catch (e) {
        setError(
          (e as ApiError).message || 'Could not load your salary breakdown.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-accent hover:underline">
          ← Back to Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">My Salary Breakdown</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your current salary structure as configured by HR. Estimate
          assumes no LWP and no overtime — the actual payslip is the
          authoritative number once a payroll run releases.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top-line tiles: Gross / Net / CTC at a glance. */}
      {data.computed_preview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile
            label="Gross (monthly)"
            value={formatINR(data.computed_preview.gross)}
            tone="neutral"
          />
          <Tile
            label="Estimated Net Payable"
            value={formatINR(data.computed_preview.estimated_net_payable)}
            tone="primary"
          />
          <Tile
            label="Monthly CTC"
            value={formatINR(data.computed_preview.ctc)}
            tone="neutral"
          />
        </div>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-4">Component-wise Breakdown</h2>
        <SalaryBreakdownTable
          preview={data.computed_preview}
          emptyMessage="Your salary configuration is incomplete — please contact HR."
          summaryLevel="employee"
        />
        <p className="mt-4 text-xs text-text-secondary">
          To see the exact figures for a specific month (with leave
          deductions, overtime, and any admin adjustments applied),
          download the corresponding payslip from{' '}
          <Link href="/payroll/payslips" className="text-accent hover:underline">
            My Payslips
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'primary';
}) {
  const bg =
    tone === 'primary'
      ? 'bg-[#f0f9ff] border-[#bae6fd]'
      : 'bg-white border-border';
  return (
    <div className={`rounded-xl border ${bg} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold text-text-primary">
        {value}
      </p>
    </div>
  );
}
