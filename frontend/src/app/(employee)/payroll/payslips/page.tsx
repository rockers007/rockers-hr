'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { formatINR, MONTHS } from '@/lib/payroll-types';
import { formatDate } from '@/lib/utils';

interface PayslipRow {
  run_id: string;
  month: number;
  year: number;
  release_date: string | null;
  net_payable: string;
  total_earnings: string;
  total_deductions: string;
}

export default function EmployeePayslipsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<PayslipRow[]>('/payroll/me/payslips');
        setRows(data);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const download = async (year: number, month: number) => {
    try {
      const data = await api.get<{ signed_url: string; password_hint: string }>(
        `/payroll/me/payslips/${year}/${month}/download`,
      );
      if (!data?.signed_url) {
        alert(
          'Payslip PDF is not yet generated. PDF generation ships in Phase F.',
        );
        return;
      }
      window.open(data.signed_url, '_blank');
    } catch (e) {
      alert((e as ApiError).message);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-accent hover:underline">
          ← Back to Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">My Payslips</h1>
        <p className="text-sm text-text-secondary">
          Your released payslips. PDFs are password-protected with your DOB in
          DDMM format.
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No payslips released yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Earnings</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net Payable</th>
                <th className="px-4 py-3">Released</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={`${r.year}-${r.month}`}>
                  <td className="px-4 py-3 font-medium">
                    {MONTHS[r.month - 1]} {r.year}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatINR(r.total_earnings)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatINR(r.total_deductions)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatINR(r.net_payable)}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {r.release_date
                      ? formatDate(r.release_date)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => download(r.year, r.month)}
                    >
                      Download
                    </Button>
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
