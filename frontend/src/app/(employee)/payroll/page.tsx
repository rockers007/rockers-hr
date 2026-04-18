'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/spinner';
import { formatINR, MONTHS } from '@/lib/payroll-types';

interface SalaryPreview {
  preview_month: string;
  preview_year: number;
  note: string;
  gross?: string;
  sal_for_calc?: string;
  estimated_net_payable?: string;
  total_earnings?: string;
  total_deductions?: string;
  ctc?: string;
}

interface PayslipRow {
  run_id: string;
  month: number;
  year: number;
  release_date: string | null;
  net_payable: string;
  total_earnings: string;
  total_deductions: string;
}

interface YtdRow {
  user_id: string;
  financial_year: string;
  ytd_earnings: string;
  ytd_employee_pf: string;
  ytd_tds: string;
  ytd_net_payable: string;
  months_processed: string;
}

export default function EmployeePayrollDashboard() {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<SalaryPreview | null>(null);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [ytd, setYtd] = useState<YtdRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, s, y] = await Promise.all([
          api.get<SalaryPreview>('/payroll/me/salary-preview').catch(() => null),
          api.get<PayslipRow[]>('/payroll/me/payslips').catch(() => []),
          api.get<YtdRow[]>('/payroll/me/ytd').catch(() => []),
        ]);
        setPreview(p);
        setPayslips(s ?? []);
        setYtd(y ?? []);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageLoader />;

  const lastPayslip = payslips[0];
  const currentFy = ytd[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Payroll</h1>
        <p className="text-sm text-text-secondary">
          Your salary, payslips, and tax helpers.
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Current Month Preview
          </h2>
          {preview ? (
            <>
              <p className="mt-1 text-xs text-text-secondary">
                {preview.preview_month} {preview.preview_year} — if paid today
              </p>
              <p className="mt-3 text-2xl font-semibold text-text-primary">
                {formatINR(preview.estimated_net_payable)}
              </p>
              <p className="mt-2 text-xs text-text-secondary">{preview.note}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              Salary config not yet set.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Last Payslip
          </h2>
          {lastPayslip ? (
            <>
              <p className="mt-1 text-xs text-text-secondary">
                {MONTHS[lastPayslip.month - 1]} {lastPayslip.year}
              </p>
              <p className="mt-3 text-2xl font-semibold text-text-primary">
                {formatINR(lastPayslip.net_payable)}
              </p>
              <Link
                href="/payroll/payslips"
                className="mt-2 block text-xs text-accent hover:underline"
              >
                View all payslips →
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              No payslips released yet.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            YTD {currentFy?.financial_year ?? '—'}
          </h2>
          {currentFy ? (
            <>
              <p className="mt-3 text-2xl font-semibold text-text-primary">
                {formatINR(currentFy.ytd_net_payable)}
              </p>
              <dl className="mt-2 space-y-1 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <dt>Earnings</dt>
                  <dd>{formatINR(currentFy.ytd_earnings)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>PF contributed</dt>
                  <dd>{formatINR(currentFy.ytd_employee_pf)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>TDS paid</dt>
                  <dd>{formatINR(currentFy.ytd_tds)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Months</dt>
                  <dd>{currentFy.months_processed}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              No YTD data yet — starts after first released payroll.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <QuickLink
          href="/payroll/payslips"
          title="My Payslips"
          desc="Download password-protected PDFs."
        />
        <QuickLink
          href="/payroll/salary"
          title="Salary Breakdown"
          desc="View your current structure and 7-component split."
        />
        <QuickLink
          href="/payroll/bank-change"
          title="Bank Details"
          desc="View current account or request a change."
        />
        <QuickLink
          href="/payroll/investment-proofs"
          title="Investment Proofs"
          desc="Upload 80C, HRA, and other tax documents."
        />
      </div>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-card-bg p-5 shadow-sm transition-colors hover:border-accent"
    >
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{desc}</p>
    </Link>
  );
}
