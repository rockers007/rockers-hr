'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import {
  PayrollSalaryComponent,
  PayrollStatutoryConfig,
} from '@/lib/payroll-types';

type Tab = 'components' | 'statutory';

export default function MasterPayrollPage() {
  const [tab, setTab] = useState<Tab>('components');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Configuration</h1>
        <p className="text-sm text-text-secondary">
          Edit salary components, statutory rates, and other master data. All
          changes apply from the next payroll run.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          <TabBtn active={tab === 'components'} onClick={() => setTab('components')}>
            Salary Components
          </TabBtn>
          <TabBtn active={tab === 'statutory'} onClick={() => setTab('statutory')}>
            Statutory Config
          </TabBtn>
        </nav>
      </div>

      {tab === 'components' && <ComponentsEditor />}
      {tab === 'statutory' && <StatutoryEditor />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-1 pb-3 text-sm font-medium ${
        active
          ? 'border-accent text-accent'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function ComponentsEditor() {
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<PayrollSalaryComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<PayrollSalaryComponent[]>(
          '/payroll/master/components',
        );
        setComponents(data);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sum = components.reduce((acc, c) => acc + Number(c.percentage), 0);
  const balanced = Math.abs(sum - 100) < 0.01;
  const pfBaseCount = components.filter((c) => c.is_pf_base).length;

  const updatePct = (code: string, pct: string) => {
    setComponents((cs) =>
      cs.map((c) => (c.code === code ? { ...c, percentage: pct } : c)),
    );
  };

  const togglePfBase = (code: string) => {
    setComponents((cs) =>
      cs.map((c) => ({ ...c, is_pf_base: c.code === code })),
    );
  };

  const save = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const data = await api.put<PayrollSalaryComponent[]>(
        '/payroll/master/components',
        { components },
      );
      setComponents(data);
      setSuccess('Saved. New values apply from next payroll run.');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">7 Salary Components</h2>
        <div className="text-sm">
          Sum:{' '}
          <span className={balanced ? 'text-green-700' : 'text-red-700'}>
            {sum.toFixed(2)}%
          </span>{' '}
          {balanced ? '✓' : '(must equal 100.00)'}
        </div>
      </div>

      <div className="rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Display Name</th>
              <th className="px-3 py-2 text-left">Payslip Label</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-center">PF Base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {components.map((c) => (
              <tr key={c.code}>
                <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                <td className="px-3 py-2">{c.display_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{c.payslip_label}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={c.percentage}
                    onChange={(e) => updatePct(c.code, e.target.value)}
                    className="w-20 rounded border border-border px-2 py-1 text-right"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="radio"
                    name="pf_base"
                    checked={c.is_pf_base}
                    onChange={() => togglePfBase(c.code)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded bg-green-50 p-3 text-sm text-green-800">{success}</div>}

      <div className="flex justify-end gap-2">
        <Button
          onClick={save}
          disabled={saving || !balanced || pfBaseCount !== 1}
        >
          {saving ? 'Saving…' : 'Save Components'}
        </Button>
      </div>
    </Card>
  );
}

function StatutoryEditor() {
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<PayrollStatutoryConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<PayrollStatutoryConfig>(
          '/payroll/master/statutory',
        );
        setCfg(data);
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !cfg) return <PageLoader />;

  const update = (field: keyof PayrollStatutoryConfig, value: unknown) => {
    setCfg({ ...cfg, [field]: value } as PayrollStatutoryConfig);
  };

  const save = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const { id, ...rest } = cfg;
      const saved = await api.patch<PayrollStatutoryConfig>(
        '/payroll/master/statutory',
        rest,
      );
      setCfg(saved);
      setSuccess('Saved. New values apply from next payroll run.');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEsic = async () => {
    const expected = 'ACTIVATE ESIC';
    const typed = window.prompt(
      `ESIC activation toggle — type exactly:\n${expected}`,
    );
    if (typed !== expected) return;
    try {
      const saved = await api.post<PayrollStatutoryConfig>(
        '/payroll/master/statutory/esic/activate',
        { activate: !cfg.esic_active, confirmation_phrase: typed },
      );
      setCfg(saved);
      setSuccess(saved.esic_active ? 'ESIC activated.' : 'ESIC deactivated.');
    } catch (e) {
      setError((e as ApiError).message);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">PF</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Cap Amount (₹)" value={cfg.pf_cap_amount} onChange={(v) => update('pf_cap_amount', v)} />
          <Field label="Fixed at Cap (₹)" value={cfg.pf_fixed_at_cap} onChange={(v) => update('pf_fixed_at_cap', v)} />
          <Field label="Rate below cap" value={cfg.pf_rate_below_cap} onChange={(v) => update('pf_rate_below_cap', v)} />
          <Toggle
            label="Employer matches employee"
            checked={cfg.pf_employer_matches_employee}
            onChange={(v) => update('pf_employer_matches_employee', v)}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">ESIC</h2>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                cfg.esic_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cfg.esic_active ? 'ACTIVE' : 'INACTIVE'}
            </span>
            <Button variant="secondary" onClick={toggleEsic}>
              {cfg.esic_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Threshold Gross (₹)" value={cfg.esic_threshold_gross} onChange={(v) => update('esic_threshold_gross', v)} />
          <Field label="Employer Rate" value={cfg.esic_employer_rate} onChange={(v) => update('esic_employer_rate', v)} />
          <Field label="Employee Rate" value={cfg.esic_employee_rate} onChange={(v) => update('esic_employee_rate', v)} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Overtime & PT</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="OT Multiplier" value={cfg.ot_multiplier} onChange={(v) => update('ot_multiplier', v)} />
          <Field label="OT Divisor — Day" value={cfg.ot_divisor_day} onChange={(v) => update('ot_divisor_day', v)} />
          <Field label="OT Divisor — Hour" value={cfg.ot_divisor_hour} onChange={(v) => update('ot_divisor_hour', v)} />
          <Field label="Professional Tax (₹)" value={cfg.pt_flat_amount} onChange={(v) => update('pt_flat_amount', v)} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">General</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Cycle Days" value={String(cfg.payroll_cycle_days)} onChange={(v) => update('payroll_cycle_days', Number(v))} />
          <Field label="FY Start Month" value={String(cfg.financial_year_start_month)} onChange={(v) => update('financial_year_start_month', Number(v))} />
          <Field label="Currency" value={cfg.currency} onChange={(v) => update('currency', v)} />
        </div>
      </section>

      {error && <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded bg-green-50 p-3 text-sm text-green-800">{success}</div>}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Statutory Config'}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-white px-3 py-1.5 text-sm"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 pt-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
