'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MONTHS, formatINR } from '@/lib/payroll-types';

type Tab = 'salary-register' | 'department-cost' | 'payroll-summary' | 'compliance';

export default function PayrollReportsPage() {
  const [tab, setTab] = useState<Tab>('salary-register');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setResult(null);
    setError('');
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (tab !== 'payroll-summary') params.set('month', String(month));
    if (tab === 'payroll-summary') params.set('period', period);

    try {
      const data = await api.get(`/payroll/reports/${tab}?${params.toString()}`);
      setResult(data);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    const params = new URLSearchParams({ year: String(year), format: 'csv' });
    if (tab !== 'payroll-summary') params.set('month', String(month));
    if (tab === 'payroll-summary') params.set('period', period);
    const token = localStorage.getItem('token');
    const url = `/api/v1/payroll/reports/${tab}?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const dl = document.createElement('a');
        dl.href = URL.createObjectURL(blob);
        dl.download = `${tab}_${year}${tab !== 'payroll-summary' ? `_${month}` : `_${period}`}.csv`;
        dl.click();
      });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Reports</h1>
        <p className="text-sm text-text-secondary">
          Reports run against the latest REVIEW-or-later payroll for the chosen
          month. Results reflect the current payroll_items set.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {(['salary-register', 'department-cost', 'payroll-summary', 'compliance'] as Tab[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setResult(null);
                }}
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

      <Card className="space-y-4">
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
            <Button onClick={run} disabled={loading}>
              {loading ? 'Running…' : 'Run'}
            </Button>
            {result !== null && (
              <Button variant="secondary" onClick={downloadCsv}>
                Download CSV
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
      </Card>

      {result !== null && <ResultView tab={tab} result={result} />}
    </div>
  );
}

function ResultView({ tab, result }: { tab: Tab; result: unknown }) {
  if (tab === 'salary-register') {
    const r = result as {
      rows: Array<Record<string, string | null>>;
      totals: Record<string, string | null>;
    };
    return (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">Emp No</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Dept</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">PF (Emp)</th>
                <th className="px-3 py-2 text-right">PT</th>
                <th className="px-3 py-2 text-right">TDS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {r.rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{row.emp_number ?? '—'}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.department ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{formatINR(row.gross)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatINR(row.net_payable)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(row.employee_pf)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(row.professional_tax)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(row.tds)}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={3} className="px-3 py-2">
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right">{formatINR(r.totals.gross)}</td>
                <td className="px-3 py-2 text-right">{formatINR(r.totals.net_payable)}</td>
                <td className="px-3 py-2 text-right">{formatINR(r.totals.employee_pf)}</td>
                <td className="px-3 py-2 text-right">{formatINR(r.totals.professional_tax)}</td>
                <td className="px-3 py-2 text-right">{formatINR(r.totals.tds)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (tab === 'department-cost') {
    const r = result as { rows: Array<Record<string, string | number>> };
    return (
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-right">Headcount</th>
              <th className="px-3 py-2 text-right">Total Gross</th>
              <th className="px-3 py-2 text-right">Total CTC</th>
              <th className="px-3 py-2 text-right">Net Payable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {r.rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{(row.department as string) ?? '—'}</td>
                <td className="px-3 py-2 text-right">{row.headcount}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_gross as string)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_ctc as string)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_net_payable as string)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  if (tab === 'payroll-summary') {
    const r = result as { rows: Array<Record<string, string | number>> };
    return (
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-right">Runs</th>
              <th className="px-3 py-2 text-right">Employees</th>
              <th className="px-3 py-2 text-right">Net Payable</th>
              <th className="px-3 py-2 text-right">Employer PF</th>
              <th className="px-3 py-2 text-right">TDS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {r.rows.map((row, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-medium">{row.period}</td>
                <td className="px-3 py-2 text-right">{row.runs}</td>
                <td className="px-3 py-2 text-right">{row.employees}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_net_payable as string)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_employer_pf as string)}</td>
                <td className="px-3 py-2 text-right">{formatINR(row.total_tds as string)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  if (tab === 'compliance') {
    const r = result as Record<string, string | number>;
    const items = [
      ['Employer PF', r.total_employer_pf],
      ['Employee PF', r.total_employee_pf],
      ['Employer ESIC', r.total_employer_esic],
      ['Employee ESIC', r.total_employee_esic],
      ['Professional Tax', r.total_pt],
      ['TDS', r.total_tds],
    ];
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {items.map(([label, value]) => (
          <Card key={label as string}>
            <div className="text-xs uppercase text-text-secondary">{label}</div>
            <div className="mt-1 text-xl font-semibold">
              {formatINR(value as string)}
            </div>
          </Card>
        ))}
        <Card>
          <div className="text-xs uppercase text-text-secondary">Employees</div>
          <div className="mt-1 text-xl font-semibold">{r.employee_count}</div>
        </Card>
      </div>
    );
  }

  return null;
}
