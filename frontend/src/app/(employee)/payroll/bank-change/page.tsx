'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import {
  BankChangeRequest,
  PayrollSalary,
} from '@/lib/payroll-types';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function BankChangePage() {
  const [loading, setLoading] = useState(true);
  const [salary, setSalary] = useState<PayrollSalary | null>(null);
  const [history, setHistory] = useState<BankChangeRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newBank, setNewBank] = useState('');
  const [newAcc, setNewAcc] = useState('');
  const [newAccConfirm, setNewAccConfirm] = useState('');
  const [newIfsc, setNewIfsc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        api.get<PayrollSalary>('/payroll/me/salary'),
        api.get<BankChangeRequest[]>('/payroll/bank-change/mine'),
      ]);
      setSalary(s);
      setHistory(h);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setError('');
    setSuccess('');
    if (!newBank.trim() || !newAcc.trim() || !newIfsc.trim()) {
      setError('All fields are required.');
      return;
    }
    if (newAcc !== newAccConfirm) {
      setError('Account number confirmation does not match.');
      return;
    }
    if (!IFSC_REGEX.test(newIfsc)) {
      setError('IFSC format is invalid (e.g. HDFC0001234).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/payroll/bank-change', {
        new_bank_name: newBank.trim(),
        new_account_no: newAcc.trim(),
        new_ifsc: newIfsc.trim().toUpperCase(),
      });
      setSuccess('Request submitted. HR will review shortly.');
      setShowForm(false);
      setNewBank('');
      setNewAcc('');
      setNewAccConfirm('');
      setNewIfsc('');
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  const hasPending = history.some((h) => h.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div>
        <Link href="/payroll" className="text-sm text-accent hover:underline">
          ← Back to Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Bank Details</h1>
        <p className="text-sm text-text-secondary">
          Change requests take effect from the next payroll run.
        </p>
      </div>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Current Details</h2>
        <Row label="Bank" value={salary?.bank_name ?? '—'} />
        <Row
          label="Account No."
          value={salary?.bank_account_no ?? '—'}
        />
        <Row label="IFSC" value={salary?.bank_ifsc ?? '—'} />
      </Card>

      {!showForm && !hasPending && (
        <Button onClick={() => setShowForm(true)}>Request Change</Button>
      )}
      {hasPending && (
        <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-900">
          You already have a pending change request. HR must approve or reject
          it before you can submit another.
        </div>
      )}

      {showForm && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">New Bank Details</h2>
          <Field
            label="Bank Name"
            value={newBank}
            onChange={setNewBank}
          />
          <Field
            label="Account Number"
            value={newAcc}
            onChange={setNewAcc}
          />
          <Field
            label="Re-enter Account Number"
            value={newAccConfirm}
            onChange={setNewAccConfirm}
          />
          <Field
            label="IFSC Code"
            value={newIfsc}
            onChange={setNewIfsc}
            placeholder="e.g. HDFC0001234"
          />
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </div>
        </Card>
      )}

      {success && (
        <div className="rounded bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <Card>
        <h2 className="px-6 pt-6 text-lg font-semibold">Request History</h2>
        {history.length === 0 ? (
          <div className="p-6 text-sm text-text-secondary">No past requests.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">New Bank</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3">
                    {new Date(h.submitted_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    {h.new_bank_name} · {h.new_ifsc}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        h.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800'
                          : h.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {h.status}
                    </span>
                    {h.rejection_reason && (
                      <p className="mt-1 text-xs italic text-text-secondary">
                        {h.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {h.reviewed_at
                      ? new Date(h.reviewed_at).toLocaleDateString('en-IN')
                      : '—'}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
      />
    </label>
  );
}
