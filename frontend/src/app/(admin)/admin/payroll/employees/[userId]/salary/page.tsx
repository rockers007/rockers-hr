'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { PayrollSalary } from '@/lib/payroll-types';
import { SalaryBreakdownTable } from '@/components/payroll/salary-breakdown-table';

export default function SalaryConfigPage() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<PayrollSalary | null>(null);
  const [original, setOriginal] = useState<PayrollSalary | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<PayrollSalary>(
          `/payroll/employees/${userId}/salary`,
        );
        setData(d);
        setOriginal(d);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const dirty =
    data &&
    original &&
    JSON.stringify({
      gross: data.gross,
      incentive: data.incentive,
      tds: data.tds,
      loan_emi: data.loan_emi,
      sal_deduction: data.sal_deduction,
      security_return: data.security_return,
      pf_applicable: data.pf_applicable,
      esic_applicable: data.esic_applicable,
    }) !==
      JSON.stringify({
        gross: original.gross,
        incentive: original.incentive,
        tds: original.tds,
        loan_emi: original.loan_emi,
        sal_deduction: original.sal_deduction,
        security_return: original.security_return,
        pf_applicable: original.pf_applicable,
        esic_applicable: original.esic_applicable,
      });

  const update = <K extends keyof PayrollSalary>(field: K, value: PayrollSalary[K]) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const save = async () => {
    if (!data) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updated = await api.patch<PayrollSalary>(
        `/payroll/employees/${userId}/salary`,
        {
          gross: Number(data.gross),
          incentive: Number(data.incentive),
          tds: Number(data.tds),
          loan_emi: Number(data.loan_emi),
          sal_deduction: Number(data.sal_deduction),
          security_return: Number(data.security_return),
          pf_applicable: data.pf_applicable,
          esic_applicable: data.esic_applicable,
        },
      );
      setData(updated);
      setOriginal(updated);
      setSuccess('Saved. Next payroll run will use these values.');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/employees/${userId}`}
          className="text-sm text-accent hover:underline"
        >
          ← Back to employee
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Salary Configuration</h1>
        <p className="text-sm text-text-secondary">
          {data.name ?? '—'} · {data.emp_number ?? '—'} ·{' '}
          {data.designation ?? '—'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Structure</h2>

          <NumField
            label="Gross (₹)"
            value={data.gross}
            onChange={(v) => update('gross', v)}
          />
          <ToggleRow
            label="PF Applicable"
            checked={data.pf_applicable}
            onChange={(v) => update('pf_applicable', v)}
          />
          <ToggleRow
            label="ESIC Applicable"
            checked={data.esic_applicable}
            onChange={(v) => update('esic_applicable', v)}
          />
          <NumField
            label="Incentive / Fix Variable (₹)"
            value={data.incentive}
            onChange={(v) => update('incentive', v)}
          />
          <NumField
            label="TDS monthly (₹)"
            value={data.tds}
            onChange={(v) => update('tds', v)}
          />
          <NumField
            label="Loan EMI (₹)"
            value={data.loan_emi}
            onChange={(v) => update('loan_emi', v)}
          />
          <NumField
            label="Salary Deduction (₹)"
            value={data.sal_deduction}
            onChange={(v) => update('sal_deduction', v)}
          />
          <NumField
            label="Security Return (₹)"
            value={data.security_return}
            onChange={(v) => update('security_return', v)}
          />

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => original && setData(original)}
              disabled={!dirty}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Salary Breakdown</h2>
            <p className="mt-1 text-xs text-text-secondary">
              What-if preview — assumes no LWP and no OT. Values update
              live when you change gross / incentive on the left and
              save. Same row layout as the payroll-run detail view.
            </p>
          </div>

          <SalaryBreakdownTable
            preview={data.computed_preview}
            emptyMessage="Set a gross amount and save to compute the breakdown."
          />

          <div className="border-t border-border pt-3">
            <h3 className="text-sm font-semibold">Bank Details (read-only)</h3>
            <p className="mt-1 text-xs text-text-secondary">
              Employees request bank changes via self-service.
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Bank" value={data.bank_name ?? '—'} />
              <Row label="A/C" value={data.bank_account_no ?? '—'} />
              <Row label="IFSC" value={data.bank_ifsc ?? '—'} />
              <Row label="DOB" value={data.dob ?? '—'} />
            </dl>
            {!data.dob && (
              <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Warning: DOB missing — payslip PDF cannot be generated without it.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded border border-border bg-gray-50 px-3 py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-text-primary' : ''}`}>
      <dt className="text-text-secondary">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
