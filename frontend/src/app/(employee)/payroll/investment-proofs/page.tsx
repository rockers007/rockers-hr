'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { formatINR } from '@/lib/payroll-types';

interface InvestmentProof {
  id: string;
  user_id: string;
  financial_year: string;
  category: string;
  description: string | null;
  amount: string | null;
  s3_key: string;
  mime_type: string | null;
  uploaded_at: string;
}

function currentFy(): string {
  const d = new Date();
  // FY starts April 1
  const y = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export default function InvestmentProofsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InvestmentProof[]>([]);
  const [fy, setFy] = useState(currentFy());
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('80C');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<InvestmentProof[]>(
        `/payroll/investment-proofs/mine?fy=${fy}`,
      );
      setRows(data);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fy]);

  const submit = async () => {
    setError('');
    if (!file) {
      setError('Please choose a file.');
      return;
    }
    setUploading(true);
    try {
      // Step 1: presigned upload
      const pre = await api.post<{ upload_url: string; s3_key: string }>(
        '/uploads/presigned',
        {
          mime_type: file.type,
          file_size_bytes: file.size,
          context: 'investment_proof',
        },
      );
      // Step 2: PUT to S3
      await fetch(pre.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      // Step 3: register the proof
      await api.post('/payroll/investment-proofs', {
        financial_year: fy,
        category,
        description: description || undefined,
        amount: amount ? Number(amount) : undefined,
        s3_key: pre.s3_key,
        file_size_bytes: file.size,
        mime_type: file.type,
      });
      setShowForm(false);
      setDescription('');
      setAmount('');
      setFile(null);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this proof?')) return;
    try {
      await api.delete(`/payroll/investment-proofs/${id}`);
      await load();
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
        <h1 className="mt-2 text-2xl font-semibold">Investment Proofs</h1>
        <p className="text-sm text-text-secondary">
          Upload tax-saving documents (80C, HRA rent receipts, etc.) for the FY.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm">
          Financial Year{' '}
          <input
            type="text"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="ml-2 rounded border border-border bg-white px-2 py-1 text-sm"
            placeholder="2025-2026"
          />
        </label>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Upload New Proof</Button>
        )}
      </Card>

      {showForm && (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">New Proof</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="80C">80C (Investments)</option>
                <option value="HRA">HRA (Rent Receipts)</option>
                <option value="80D">80D (Medical Insurance)</option>
                <option value="Home Loan">Home Loan Interest</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Amount (₹, optional)
              </span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Description (optional)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              File (PDF / JPG / PNG, ≤ 5MB)
            </span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block"
            />
          </label>
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No proofs uploaded for {fy}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.category}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.amount ? formatINR(r.amount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    {new Date(r.uploaded_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => remove(r.id)}
                    >
                      Remove
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
