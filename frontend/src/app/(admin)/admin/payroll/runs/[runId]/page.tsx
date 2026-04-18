'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import {
  PayrollRun,
  PayrollItem,
  MONTHS,
  formatINR,
  stateLabel,
} from '@/lib/payroll-types';

interface ItemsResp {
  items: PayrollItem[];
  total: number;
  page: number;
  pageSize: number;
}

const STEPS = [
  { num: 1, key: 'select', label: 'Select Month' },
  { num: 2, key: 'import', label: 'Import Leave & OT' },
  { num: 3, key: 'calculate', label: 'Calculate' },
  { num: 4, key: 'review', label: 'Review' },
  { num: 5, key: 'lock', label: 'Lock & Release' },
];

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<PayrollRun>(`/payroll/runs/${runId}`);
      setRun(r);
      if (['REVIEW', 'LOCKED', 'RELEASED', 'BANK_FILE_APPROVED', 'BANK_FILE_GENERATED'].includes(r.state)) {
        const data = await api.get<ItemsResp>(
          `/payroll/runs/${runId}/items?pageSize=200${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        );
        setItems(data.items);
      } else {
        setItems([]);
      }
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [runId, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentStep = useMemo(() => {
    if (!run) return 1;
    if (run.state === 'DRAFT') return 2;
    if (run.state === 'IN_PROGRESS') return 3;
    if (run.state === 'REVIEW') return 4;
    return 5;
  }, [run]);

  const doAction = async (
    action: 'import' | 'calculate' | 'cancel',
    body?: unknown,
  ) => {
    setBusy(action);
    setError('');
    try {
      await api.post(`/payroll/runs/${runId}/${action}`, body);
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const lockRun = async () => {
    if (!run) return;
    const phrase = `LOCK ${MONTHS[run.month - 1].toUpperCase()} ${run.year}`;
    const typed = window.prompt(
      `This is irreversible. Type exactly:\n${phrase}`,
    );
    if (typed !== phrase) {
      setError('Confirmation phrase did not match. Lock aborted.');
      return;
    }
    setBusy('lock');
    setError('');
    try {
      await api.post(`/payroll/runs/${runId}/lock`, { confirmation_phrase: typed });
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const releaseRun = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const date = window.prompt('Release date (YYYY-MM-DD):', today);
    if (!date) return;
    setBusy('release');
    setError('');
    try {
      await api.post(`/payroll/runs/${runId}/release`, { release_date: date });
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const editItem = async (userId: string, field: string, value: string) => {
    if (!window.confirm(`Update ${field} to ${value}?`)) return;
    setBusy(`edit-${userId}`);
    try {
      await api.patch(`/payroll/runs/${runId}/items/${userId}`, {
        [field]: Number(value),
      });
      await refresh();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PageLoader />;
  if (!run) return <div className="p-6 text-red-700">Run not found</div>;

  const st = stateLabel(run.state);
  const cancelable = ['DRAFT', 'IN_PROGRESS', 'REVIEW'].includes(run.state);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/payroll/runs" className="text-sm text-accent hover:underline">
            ← All runs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {MONTHS[run.month - 1]} {run.year}
          </h1>
          <div className="mt-1 flex items-center gap-3">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
              {st.label}
            </span>
            <span className="text-xs text-text-secondary">
              {run.total_employees} employees
            </span>
          </div>
        </div>
        {cancelable && (
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('Cancel this payroll run?')) {
                doAction('cancel');
              }
            }}
            disabled={!!busy}
          >
            Cancel Run
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Progress bar */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const active = s.num === currentStep;
            const done = s.num < currentStep || ['RELEASED','BANK_FILE_APPROVED','BANK_FILE_GENERATED'].includes(run.state);
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                      done
                        ? 'bg-green-600 text-white'
                        : active
                        ? 'bg-accent text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {done ? '✓' : s.num}
                  </div>
                  <span className="mt-2 text-xs text-center text-text-secondary max-w-24">
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-12 ${done ? 'bg-green-600' : 'bg-gray-300'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Step body */}
      {run.state === 'DRAFT' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 2 — Import leave & overtime</h2>
          <p className="text-sm text-text-secondary">
            Imports approved LWP / CL / SL / PL / WFH / Comp-Off from the leave
            module and approved overtime hours for {MONTHS[run.month - 1]}{' '}
            {run.year}, then snapshots each employee&apos;s salary structure.
          </p>
          <Button
            onClick={() => doAction('import')}
            disabled={busy === 'import'}
          >
            {busy === 'import' ? 'Importing…' : 'Import & Snapshot'}
          </Button>
        </Card>
      )}

      {run.state === 'IN_PROGRESS' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 3 — Calculate salaries</h2>
          <p className="text-sm text-text-secondary">
            Runs the deterministic engine for all {run.total_employees}{' '}
            employees. Snapshots from Step 2 are the source — live master data
            is not consulted.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => doAction('import')} variant="secondary" disabled={!!busy}>
              Re-import
            </Button>
            <Button onClick={() => doAction('calculate')} disabled={busy === 'calculate'}>
              {busy === 'calculate' ? 'Calculating…' : 'Calculate All'}
            </Button>
          </div>
        </Card>
      )}

      {run.state === 'REVIEW' && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <TotalCard label="Net Payable" value={run.total_net_payable} />
            <TotalCard label="Employer PF" value={run.total_employer_pf} />
            <TotalCard label="Employee PF" value={run.total_employee_pf} />
            <TotalCard label="TDS" value={run.total_tds} />
            <TotalCard label="Professional Tax" value={run.total_pt} />
            <TotalCard label="Incentive" value={run.total_incentive} />
            <TotalCard label="OT Pay" value={run.total_ot_pay} />
            <TotalCard label="Employees" value={String(run.total_employees)} raw />
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Step 4 — Review salary register</h2>
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or emp no."
                  className="rounded border border-border bg-white px-3 py-1.5 text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={() => doAction('calculate')}
                  disabled={!!busy}
                >
                  Recalculate All
                </Button>
                <Button onClick={lockRun} disabled={!!busy}>
                  {busy === 'lock' ? 'Locking…' : 'Proceed to Lock'}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Emp No</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">SFC</th>
                    <th className="px-4 py-3 text-right">Incentive</th>
                    <th className="px-4 py-3 text-right">OT Pay</th>
                    <th className="px-4 py-3 text-right">PF (Emp)</th>
                    <th className="px-4 py-3 text-right">TDS</th>
                    <th className="px-4 py-3 text-right">Loan</th>
                    <th className="px-4 py-3 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{it.emp_number ?? '—'}</td>
                      <td className="px-4 py-2">{it.user_name ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{formatINR(Number(it.basic_actual) * 2)}</td>
                      <td className="px-4 py-2 text-right">{formatINR(it.sal_for_calc)}</td>
                      <td className="px-4 py-2 text-right">
                        <EditableCell
                          value={it.fix_variable}
                          onSave={(v) => editItem(it.user_id, 'incentive', v)}
                          disabled={busy !== null}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">{formatINR(it.ot_pay)}</td>
                      <td className="px-4 py-2 text-right">{formatINR(it.employee_pf)}</td>
                      <td className="px-4 py-2 text-right">
                        <EditableCell
                          value={it.tds}
                          onSave={(v) => editItem(it.user_id, 'tds', v)}
                          disabled={busy !== null}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <EditableCell
                          value={it.loan_emi}
                          onSave={(v) => editItem(it.user_id, 'loan_emi', v)}
                          disabled={busy !== null}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatINR(it.net_payable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {run.state === 'LOCKED' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 5b — Release payslips</h2>
          <p className="text-sm text-text-secondary">
            Payroll is locked. Release generates password-protected PDF
            payslips (Phase F) and emails them to employees.
          </p>
          <p className="text-xs text-text-secondary">
            Locked at {run.locked_at && new Date(run.locked_at).toLocaleString('en-IN')}
          </p>
          <Button onClick={releaseRun} disabled={busy === 'release'}>
            {busy === 'release' ? 'Releasing…' : 'Release Payslips'}
          </Button>
        </Card>
      )}

      {['RELEASED', 'BANK_FILE_APPROVED', 'BANK_FILE_GENERATED'].includes(run.state) && (
        <BankFileSection runId={run.id} state={run.state} />
      )}
    </div>
  );
}

function BankFileSection({ runId, state }: { runId: string; state: string }) {
  const [preview, setPreview] = useState<{
    rows: Array<{
      user_id: string;
      emp_number: string | null;
      name: string;
      bank_name: string | null;
      net_payable: string;
      has_pending_bank_change: boolean;
    }>;
    total_amount: string;
    pending_bank_changes: number;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<typeof preview>(
          `/payroll/runs/${runId}/bank-file/preview`,
        );
        setPreview(data);
      } catch (e) {
        setError((e as ApiError).message);
      }
    })();
  }, [runId]);

  const approve = async () => {
    const phrase = 'APPROVE BANK TRANSFER FILE';
    const typed = window.prompt(
      `Confirm by typing exactly:\n${phrase}`,
    );
    if (typed !== phrase) return;
    const action =
      (preview?.pending_bank_changes ?? 0) > 0
        ? window.confirm(
            `There are ${preview?.pending_bank_changes} employees with pending bank change requests. Use old details for them? (Cancel excludes them.)`,
          )
          ? 'use_old'
          : 'exclude_employee'
        : 'use_old';
    setBusy('approve');
    try {
      await api.post(`/payroll/runs/${runId}/bank-file/approve`, {
        confirmation_phrase: typed,
        file_format_code: 'DEFAULT_NEFT',
        pending_bank_changes_action: action,
      });
      window.location.reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy('generate');
    try {
      const data = await api.post<{ signed_url?: string; file_id: string }>(
        `/payroll/runs/${runId}/bank-file/generate`,
      );
      if (data.signed_url) setDownloadUrl(data.signed_url);
      else window.location.reload();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Bank Transfer File</h2>

      {preview && (
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-xs uppercase text-text-secondary">Employees</div>
            <div className="font-semibold">{preview.rows.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-text-secondary">Total Amount</div>
            <div className="font-semibold">{formatINR(preview.total_amount)}</div>
          </div>
          {preview.pending_bank_changes > 0 && (
            <div className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {preview.pending_bank_changes} pending bank change{preview.pending_bank_changes === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {state === 'RELEASED' && (
          <Button onClick={approve} disabled={busy === 'approve'}>
            {busy === 'approve' ? 'Approving…' : 'Approve Bank Transfer File'}
          </Button>
        )}
        {(state === 'BANK_FILE_APPROVED' || state === 'BANK_FILE_GENERATED') && (
          <Button onClick={generate} disabled={busy === 'generate'}>
            {busy === 'generate' ? 'Generating…' : 'Generate / Download File'}
          </Button>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Download File ↓
          </a>
        )}
      </div>

      <p className="text-xs text-text-secondary">
        Super Admin only. Approval is irreversible once generated. Format:
        NEFT bulk upload (DEFAULT_NEFT). Signed URLs expire in 15 min.
      </p>
    </Card>
  );
}

function TotalCard({ label, value, raw }: { label: string; value: string; raw?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-text-primary">
        {raw ? value : formatINR(value)}
      </div>
    </Card>
  );
}

function EditableCell({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        className="text-right hover:underline"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        disabled={disabled}
      >
        {formatINR(value)}
      </button>
    );
  }
  return (
    <input
      type="number"
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-24 rounded border border-accent px-1 py-0.5 text-right text-sm"
    />
  );
}
