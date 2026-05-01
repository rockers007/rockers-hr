'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useMasterData } from '@/lib/master-data';
import { useAuthStore } from '@/lib/auth-store';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils';
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
  const user = useAuthStore((s) => s.user);

  // Block leave application if last working day has passed or employment is not active
  const isEmploymentEnded = (() => {
    if (user?.employment_status && user.employment_status !== 'active') return true;
    if (user?.last_working_day) {
      const lwd = new Date(user.last_working_day);
      lwd.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today > lwd;
    }
    return false;
  })();

  if (isEmploymentEnded) {
    return (
      <Card className="mt-8">
        <EmptyState
          title="Leave Application Disabled"
          description={
            user?.last_working_day
              ? `Your last working day was ${formatDate(user.last_working_day)}. You can no longer apply for leave.`
              : `Your employment status is "${user?.employment_status}". You cannot apply for leave.`
          }
        />
      </Card>
    );
  }

  const [step, setStep] = useState(1);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [eligibleTypes, setEligibleTypes] = useState<LeaveType[]>([]);

  // Step 1
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [durationTypeId, setDurationTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Early leave fields
  const [earlyLeaveDate, setEarlyLeaveDate] = useState('');
  const [earlyLeaveStartTime, setEarlyLeaveStartTime] = useState('');
  const [earlyLeaveEndTime, setEarlyLeaveEndTime] = useState('');

  // Step 2
  const [reason, setReason] = useState('');
  const [sandwichConfirmed, setSandwichConfirmed] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docS3Key, setDocS3Key] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');

  // Validation error shown on Step 1
  const [calcError, setCalcError] = useState('');

  // Step 3
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<LeaveBalance[]>('/leave/balance').then(setBalances).catch(() => {});
    // Fetch only leave types the employee is eligible for (respects probation)
    api.get<LeaveType[]>('/leave/types/eligible').then(setEligibleTypes).catch(() => {
      // Fallback to all types if endpoint fails
      setEligibleTypes(master.leave_types);
    });
  }, []);

  // Auto-calculate when dates change (regular leave)
  useEffect(() => {
    setCalcError('');
    if (!leaveTypeId || !durationTypeId) { setCalc(null); return; }
    // Check if this is early leave
    const lt = eligibleTypes.find((t) => t.id === leaveTypeId);
    if (lt?.unit === 'hours') {
      // Early leave: calculate when date + times are filled
      if (!earlyLeaveDate || !earlyLeaveStartTime || !earlyLeaveEndTime) { setCalc(null); return; }
      setCalcLoading(true);
      const timer = setTimeout(() => {
        api.post<CalcResult>('/leave/calculate', {
          leave_type_id: leaveTypeId,
          duration_type_id: durationTypeId,
          start_date: earlyLeaveDate,
          end_date: earlyLeaveDate,
          early_leave_date: earlyLeaveDate,
          early_leave_start_time: earlyLeaveStartTime,
          early_leave_end_time: earlyLeaveEndTime,
        })
          .then((data) => { setCalc(data); setCalcError(''); })
          .catch((err) => {
            setCalc(null);
            setCalcError(err instanceof ApiError ? err.message : 'Validation failed. Please check your inputs.');
          })
          .finally(() => setCalcLoading(false));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Regular leave
      if (!startDate || !endDate) { setCalc(null); return; }
      setCalcLoading(true);
      const timer = setTimeout(() => {
        api.post<CalcResult>('/leave/calculate', {
          leave_type_id: leaveTypeId,
          duration_type_id: durationTypeId,
          start_date: startDate,
          end_date: endDate,
        })
          .then((data) => { setCalc(data); setCalcError(''); })
          .catch((err) => {
            setCalc(null);
            setCalcError(err instanceof ApiError ? err.message : 'Validation failed. Please check your inputs.');
          })
          .finally(() => setCalcLoading(false));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [leaveTypeId, durationTypeId, startDate, endDate, earlyLeaveDate, earlyLeaveStartTime, earlyLeaveEndTime, eligibleTypes]);

  if (masterLoading) return <PageLoader />;

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedType = eligibleTypes.find((t) => t.id === leaveTypeId);
  const selectedDuration = master.leave_durations.find((d) => d.id === durationTypeId);
  const typeBalance = balances.find((b) => b.leave_type.id === leaveTypeId);
  const isEarlyLeave = selectedType?.unit === 'hours';

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        leave_type_id: leaveTypeId,
        duration_type_id: durationTypeId,
        start_date: isEarlyLeave ? earlyLeaveDate : startDate,
        end_date: isEarlyLeave ? earlyLeaveDate : endDate,
        reason,
        doc_s3_key: docS3Key,
        sandwich_confirmed: sandwichConfirmed,
      };
      if (isEarlyLeave) {
        body.early_leave_date = earlyLeaveDate;
        body.early_leave_start_time = earlyLeaveStartTime;
        body.early_leave_end_time = earlyLeaveEndTime;
      }
      await api.post('/leave/requests', body);
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
                {eligibleTypes.map((lt: LeaveType) => {
                  const bal = balances.find((b) => b.leave_type.id === lt.id);
                  return (
                    <button
                      key={lt.id}
                      data-testid="leave-type-option"
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

            {/* Dates — regular or early leave */}
            {isEarlyLeave ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Date</label>
                  <input
                    type="date"
                    value={earlyLeaveDate}
                    min={todayStr}
                    onChange={(e) => setEarlyLeaveDate(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Start Time</label>
                    <input
                      type="time"
                      value={earlyLeaveStartTime}
                      onChange={(e) => setEarlyLeaveStartTime(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">End Time</label>
                    <input
                      type="time"
                      value={earlyLeaveEndTime}
                      onChange={(e) => setEarlyLeaveEndTime(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                    />
                  </div>
                </div>
                {earlyLeaveStartTime && earlyLeaveEndTime && (() => {
                  const [sh, sm] = earlyLeaveStartTime.split(':').map(Number);
                  const [eh, em] = earlyLeaveEndTime.split(':').map(Number);
                  const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                  if (hours > 0) {
                    return (
                      <div className={`rounded-lg p-3 ${hours > 2 ? 'bg-[#fee2e2]' : 'bg-neutral-bg'}`}>
                        <p className={`text-sm ${hours > 2 ? 'text-[#991b1b]' : 'text-text-secondary'}`}>
                          Duration: <span className="font-medium">{hours.toFixed(1)} hours</span>
                          {hours > 2 && ' — Maximum 2 hours allowed'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">Counts as 1 day from {selectedType?.label ?? 'Early Leave'} balance</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-text-primary mb-1">From Date</label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    min={todayStr}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-text-primary mb-1">To Date</label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  />
                </div>
              </div>
            )}

            {/* Calculation Panel */}
            {calcLoading && <p className="text-sm text-text-secondary">Calculating...</p>}
            {calcError && (
              <div className="rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
                {calcError}
              </div>
            )}
            {calc && !calcError && (
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
                disabled={
                  calcLoading || !!calcError ||
                  !leaveTypeId || !durationTypeId ||
                  (isEarlyLeave
                    ? (!earlyLeaveDate || !earlyLeaveStartTime || !earlyLeaveEndTime)
                    : (!startDate || !endDate || !calc))
                }
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
              <label htmlFor="leave-reason" className="block text-sm font-medium text-text-primary mb-1">
                Reason <span className="text-danger">*</span>
              </label>
              <textarea
                id="leave-reason"
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
                {docError && (
                  <p className="mb-2 text-xs text-danger">{docError}</p>
                )}
                {docS3Key ? (
                  <div className="flex items-center justify-between rounded-lg bg-[#f0fdf4] border border-[#86efac] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-[#166534]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">{docFile?.name}</span>
                      <span className="text-[#15803d]">({((docFile?.size ?? 0) / 1024).toFixed(1)} KB) — Uploaded</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setDocFile(null); setDocS3Key(null); setDocError(''); }}
                      className="text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${docUploading ? 'border-border opacity-60' : 'border-border hover:border-accent/60 hover:bg-accent/5'}`}>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={docUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setDocFile(file);
                        setDocError('');
                        setDocUploading(true);
                        try {
                          // 1. Get presigned URL from backend
                          const { upload_url, s3_key } = await api.post<{ upload_url: string; s3_key: string; expires_in_seconds: number }>(
                            '/uploads/presigned',
                            { mime_type: file.type, file_size_bytes: file.size, context: 'leave_doc' },
                          );
                          // 2. PUT file directly to S3
                          const uploadRes = await fetch(upload_url, {
                            method: 'PUT',
                            headers: { 'Content-Type': file.type },
                            body: file,
                          });
                          if (!uploadRes.ok) throw new Error('Upload to S3 failed');
                          setDocS3Key(s3_key);
                        } catch (err) {
                          setDocFile(null);
                          setDocError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
                        } finally {
                          setDocUploading(false);
                        }
                      }}
                    />
                    {docUploading ? (
                      <p className="text-sm text-accent">Uploading...</p>
                    ) : (
                      <>
                        <svg className="mb-2 h-8 w-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <p className="text-sm font-medium text-text-primary">Click to upload document</p>
                        <p className="mt-1 text-xs text-text-secondary">PDF, JPG, PNG — max 5MB</p>
                      </>
                    )}
                  </label>
                )}
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
              <Button variant="secondary" onClick={() => { setStep(1); setError(''); }}>Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={
                  reason.length < 10 ||
                  (calc?.sandwich_detected && !sandwichConfirmed) ||
                  (calc?.doc_required && !docS3Key) ||
                  docUploading
                }
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
              {isEarlyLeave ? (
                <>
                  <DetailRow label="Date" value={earlyLeaveDate} />
                  <DetailRow label="Time" value={`${earlyLeaveStartTime} – ${earlyLeaveEndTime}`} />
                  {earlyLeaveStartTime && earlyLeaveEndTime && (() => {
                    const [sh, sm] = earlyLeaveStartTime.split(':').map(Number);
                    const [eh, em] = earlyLeaveEndTime.split(':').map(Number);
                    const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                    return <DetailRow label="Hours" value={`${hours.toFixed(1)} hours`} />;
                  })()}
                </>
              ) : (
                <>
                  <DetailRow label="From" value={startDate} />
                  <DetailRow label="To" value={endDate} />
                  <DetailRow label="Working Days" value={String(calc?.working_days ?? 0)} />
                </>
              )}
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
              <Button variant="secondary" onClick={() => { setStep(2); setError(''); }}>Back</Button>
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
