'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MONTHS } from '@/lib/payroll-types';

type Tab = 'salary-register' | 'department-cost' | 'payroll-summary' | 'compliance';

export default function PayrollReportsPage() {
  const [tab, setTab] = useState<Tab>('salary-register');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const run = async (format: 'json' | 'csv' | 'pdf') => {
    setResult('');
    setLoading(true);
    const base = `/api/v1/payroll/reports/${tab}`;
    const params = new URLSearchParams({ year: String(year), format });
    if (tab !== 'payroll-summary') params.set('month', String(month));
    if (tab === 'payroll-summary') params.set('period', period);

    try {
      const res = await fetch(`${base}?${params.toString()}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Reports</h1>
        <p className="text-sm text-text-secondary">
          Salary Register, Department Cost, Payroll Summary, and Compliance. CSV
          + PDF export lands in Phase G.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {(['salary-register', 'department-cost', 'payroll-summary', 'compliance'] as Tab[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium capitalize ${
                  tab === t
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.replace('-', ' ')}
              </button>
            ),
          )}
        </nav>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-text-secondary">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-24 rounded border border-border bg-white px-3 py-1.5 text-sm"
            />
          </div>
          {tab !== 'payroll-summary' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-text-secondary">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="mt-1 rounded border border-border bg-white px-3 py-1.5 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab === 'payroll-summary' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-text-secondary">
                Period
              </label>
              <select
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')
                }
                className="mt-1 rounded border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
          <div className="ml-auto flex items-end gap-2">
            <Button variant="secondary" onClick={() => run('json')} disabled={loading}>
              View
            </Button>
            <Button variant="secondary" onClick={() => run('csv')} disabled={loading}>
              CSV
            </Button>
            <Button onClick={() => run('pdf')} disabled={loading}>
              PDF
            </Button>
          </div>
        </div>

        {result && (
          <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {result}
          </pre>
        )}
      </Card>
    </div>
  );
}
