'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/spinner';
import { PayrollSalary, formatINR } from '@/lib/payroll-types';

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
        setError((e as ApiError).message);
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
        <h1 className="mt-2 text-2xl font-semibold">Salary Breakdown</h1>
        <p className="text-sm text-text-secondary">
          Your current structure. Changes are made by HR — not editable here.
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Structure</h2>
          <Row label="Gross" value={formatINR(data.gross)} />
          <Row label="Incentive / Fix Variable" value={formatINR(data.incentive)} />
          <Row label="PF Applicable" value={data.pf_applicable ? 'Yes' : 'No'} />
          <div className="pt-2 border-t border-border text-xs uppercase text-text-secondary">
            Deductions preview (current month, no LWP)
          </div>
          {data.computed_preview && (
            <>
              <Row label="Employee PF" value={formatINR(data.computed_preview.employee_pf)} />
              <Row label="Professional Tax" value={formatINR(data.computed_preview.professional_tax)} />
            </>
          )}
          <Row label="Monthly TDS" value={formatINR(data.tds)} />
          <Row label="Loan EMI" value={formatINR(data.loan_emi)} />
        </Card>

        {data.computed_preview && (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">This Month (0 LWP, 0 OT)</h2>
            <Row label="Sal for Calc" value={formatINR(data.computed_preview.sal_for_calc)} />
            <Row label="Total Earnings" value={formatINR(data.computed_preview.total_earnings)} />
            <Row label="Total Deductions" value={formatINR(data.computed_preview.total_deductions)} />
            <div className="pt-2 border-t border-border" />
            <Row
              label="Estimated Net Payable"
              value={formatINR(data.computed_preview.estimated_net_payable)}
              bold
            />
            <Row label="CTC" value={formatINR(data.computed_preview.ctc)} />
            <Row label="CTC As Per IT" value={formatINR(data.computed_preview.ctc_as_per_it)} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-semibold text-text-primary' : ''}`}>
      <span className="text-text-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}
