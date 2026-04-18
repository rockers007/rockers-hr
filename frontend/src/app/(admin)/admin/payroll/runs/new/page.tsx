'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PayrollRun, MONTHS } from '@/lib/payroll-types';

export default function NewRunPage() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const run = await api.post<PayrollRun>('/payroll/runs', { month, year });
      router.push(`/admin/payroll/runs/${run.id}`);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/payroll/runs" className="text-sm text-accent hover:underline">
          ← Back to runs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Start New Payroll Run</h1>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="mt-1 w-full rounded border border-border bg-white px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary">
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 w-full rounded border border-border bg-white px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-text-secondary">
            Creates a DRAFT run. Only active employees with a configured Gross
            Salary are included. Employees without Gross are skipped — set it
            via Edit Employee → Payroll.
          </p>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Run'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
