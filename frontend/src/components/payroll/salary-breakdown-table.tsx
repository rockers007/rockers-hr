'use client';

import { formatINR, type SalaryBreakdown } from '@/lib/payroll-types';

/**
 * Tabular salary breakdown — same shape used by the admin salary-config
 * page (right panel) and the employee /payroll/salary page. Mirrors the
 * row layout of payroll-run detail tables so the user sees the same
 * structure here as on the actual payslip.
 *
 * The data comes pre-shaped from the backend's
 * SalaryService.previewComputation: each row has { code, label, amount }
 * plus an is_pf_base flag on earnings rows so we can mark which line
 * Provident Fund is computed off.
 *
 * Renders an empty-state message when the engine couldn't produce a
 * preview (typically because gross is 0 or the master_salary_components
 * invariant check failed — see SalaryService.previewComputation).
 */
export function SalaryBreakdownTable({
  preview,
  emptyMessage,
}: {
  preview: SalaryBreakdown | undefined | null;
  emptyMessage?: string;
}) {
  const hasRows =
    preview && (preview.earnings.length > 0 || preview.deductions.length > 0);

  if (!preview || !hasRows) {
    return (
      <p className="text-sm text-text-secondary">
        {emptyMessage ??
          'Salary breakdown not available — set a gross amount to compute.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Earnings */}
      <Section title="Earnings">
        {preview.earnings.map((row) => (
          <Row
            key={row.code}
            label={
              <span className="flex items-center gap-2">
                {row.label}
                {row.is_pf_base && (
                  <span
                    className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700"
                    title="Provident Fund is computed off this component"
                  >
                    PF base
                  </span>
                )}
              </span>
            }
            amount={row.amount}
          />
        ))}
        <Row label="Total Earnings" amount={preview.total_earnings} bold />
      </Section>

      {/* Deductions */}
      <Section title="Deductions">
        {preview.deductions.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-text-secondary">
            No deductions for the current configuration.
          </p>
        ) : (
          preview.deductions.map((row) => (
            <Row key={row.code} label={row.label} amount={row.amount} />
          ))
        )}
        <Row label="Total Deductions" amount={preview.total_deductions} bold />
      </Section>

      {/* Net + CTC */}
      <Section title="Summary">
        <Row label="Salary for Calculation" amount={preview.sal_for_calc} />
        <Row
          label="Estimated Net Payable"
          amount={preview.estimated_net_payable}
          bold
          highlight
        />
        <Row label="Monthly CTC" amount={preview.ctc} />
        <Row label="CTC as per IT" amount={preview.ctc_as_per_it} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
  highlight,
}: {
  label: React.ReactNode;
  amount: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0 text-sm ${
        highlight ? 'bg-[#f0f9ff]' : ''
      } ${bold ? 'font-semibold' : ''}`}
    >
      <span className={bold ? 'text-text-primary' : 'text-text-secondary'}>
        {label}
      </span>
      <span className="font-mono text-text-primary">{formatINR(amount)}</span>
    </div>
  );
}
