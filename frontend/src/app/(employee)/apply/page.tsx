'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useMasterData } from '@/lib/master-data';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import type { LeaveType, MasterRecord, LeaveBalance } from '@/lib/types';

interface CalcResult {
  working_days: number;
  balance_before: number;
  balance_after: number;
  sandwich_detected: boolean;
  sandwich_detail: string | null;
  doc_required: boolean;
}

export default function ApplyLeavePage() {
  const router = useRouter();
  const { data: master, isLoading: masterLoading } = useMasterData();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  // Step 1
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [durationTypeId, setDurationTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Step 2
  const [reason, setReason] = useState('');
  const [sandwichConfirmed, setSandwichConfirmed] = useState(false);

  // Step 3
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<LeaveBalance[]>('/leave/balance').then(setBalances).catch(() => {});
  }, []);

  // Auto-calculate when dates change
  useEffect(() => {
    if (!leaveTypeId || !durationTypeId || !startDate || !endDate) {
      setCalc(null);
      return;
    }
    setCalcLoading(true);
    const timer = setTimeout(() => {
      api.post<CalcResult>('/leave/calculate', {
        leave_type_id: leaveTypeId,
        duration_type_id: durationTypeId,
        start_date: startDate,
        end_date: endDate,
      })
        .then(setCalc)
        .catch(() => setCalc(null))
        .finally(() => setCalcLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [leaveTypeId, durationTypeId, startDate, endDate]);

  if (masterLoading) return <PageLoader />;

  const selectedType = master.leave_types.find((t) => t.id === leaveTypeId);
  const selectedDuration = master.leave_durations.find((d) => d.id === durationTypeId);
  const typeBalance = balances.find((b) => b.leave_type.id === leaveTypeId);

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await api.post('/leave/requests', {
        leave_type_id: leaveTypeId,
        duration_type_id: durationTypeId,
        start_date: startDate,
        end_date: endDate,
        reason,
        doc_s3_key: null,
        sandwich_confirmed: sandwichConfirmed,
      });
      toast('Leave request submitted successfully!', 'success');
      router.push('/my-leaves');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary">Apply for Leave</h1>

      {/* Step indicator */}
      <div className="mt-4 mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? 'bg-accent text-white'
                  : s < step
                    ? 'bg-success text-white'
                    : 'bg-gray-200 text-text-secondary'
              }`}
            >
              {s < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s < 3 && <div className={`h-0.5 w-12 ${s < step ? 'bg-success' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-text-secondary">
          {step === 1 ? 'Type & Dates' : step === 2 ? 'Reason & Document' : 'Review & Submit'}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <Card>
          <div className="space-y-5">
            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Leave Type</label>
              <div className="flex flex-wrap gap-2">
                {master.leave_types.map((lt: LeaveType) => {
                  const bal = balances.find((b) => b.leave_type.id === lt.id);
                  return (
                    <button
                      key={lt.id}
                      onClick={() => setLeaveTypeId(lt.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                        leaveTypeId === lt.id
                          ? 'border-transparent text-white'
                          : 'border-border text-text-primary hover:border-accent/50'
                      }`}
                      style={leaveTypeId === lt.id ? { backgroundColor: lt.color } : {}}
                    >
                      {lt.label} {bal ? `(${bal.available_days}d)` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration Type */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Duration</label>
              <div className="flex gap-2">
                {master.leave_durations.map((d: MasterRecord) => (
                  <button
                    key={d.id}
                    onClick={() => setDurationTypeId(d.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                      durationTypeId === d.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-primary hover:border-accent/50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                />
              </div>
            </div>

            {/* Calculation Panel */}
            {calcLoading && <p className="text-sm text-text-secondary">Calculating...</p>}
            {calc && (
              <div className="rounded-lg bg-neutral-bg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Working days</span>
                  <span className="font-medium">{calc.working_days}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Balance before</span>
                  <span className="font-medium">{calc.balance_before} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Balance after</span>
                  <span className="font-medium">{calc.balance_after} days</span>
                </div>
                {calc.sandwich_detected && (
                  <div className="mt-2 rounded-lg bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e]">
                    Sandwich leave detected: {calc.sandwich_detail}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!leaveTypeId || !durationTypeId || !startDate || !endDate || !calc}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <Card>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Reason <span className="text-danger">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Please explain the reason for your leave (min 10 characters)"
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
              />
              {reason.length > 0 && reason.length < 10 && (
                <p className="mt-1 text-xs text-danger">Minimum 10 characters required</p>
              )}
            </div>

            {calc?.doc_required && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Supporting Document <span className="text-danger">*</span>
                </label>
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                  <p className="text-sm text-text-secondary">
                    Document upload — file upload integration coming soon
                  </p>
                </div>
              </div>
            )}

            {calc?.sandwich_detected && (
              <label className="flex items-start gap-3 rounded-lg bg-[#fef3c7] p-3">
                <input
                  type="checkbox"
                  checked={sandwichConfirmed}
                  onChange={(e) => setSandwichConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span className="text-sm text-[#92400e]">
                  I understand that the dates between my leave and the weekend/holiday may be counted as part of my leave.
                </span>
              </label>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={reason.length < 10 || (calc?.sandwich_detected && !sandwichConfirmed)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <Card>
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-text-primary">Review Your Application</h2>

            <div className="rounded-lg bg-neutral-bg p-4 space-y-3">
              <DetailRow label="Leave Type" value={selectedType?.label ?? ''} />
              <DetailRow label="Duration" value={selectedDuration?.label ?? ''} />
              <DetailRow label="From" value={startDate} />
              <DetailRow label="To" value={endDate} />
              <DetailRow label="Working Days" value={String(calc?.working_days ?? 0)} />
              <DetailRow label="Reason" value={reason} />
              {calc && (
                <DetailRow
                  label="Balance After Approval"
                  value={`${calc.balance_after} days remaining`}
                />
              )}
            </div>

            {/* Approval Path */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-2">Approval Path</p>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="rounded bg-gray-100 px-2 py-1">You</span>
                <span>&rarr;</span>
                <span className="rounded bg-gray-100 px-2 py-1">Manager (L1)</span>
                <span>&rarr;</span>
                <span className="rounded bg-gray-100 px-2 py-1">HR (L2)</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} isLoading={submitting}>
                Submit Leave Request
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary text-right max-w-[60%]">{value}</span>
    </div>
  );
}
