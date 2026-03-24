'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { useMasterData } from '@/lib/master-data';
import { getInitials } from '@/lib/utils';
import type { LeaveType, MasterRecord, LeaveBalance } from '@/lib/types';

interface CalcResult {
  working_days: number;
  balance_before: number;
  balance_after: number;
  sandwich_detected: boolean;
  sandwich_detail: string | null;
  doc_required: boolean;
}

interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  department: { id: string; label: string } | null;
}

export default function ApplyOnBehalfPage() {
  const params = useParams();
  const userId = params.id as string;
  const router = useRouter();
  const { data: master, isLoading: masterLoading } = useMasterData();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [durationTypeId, setDurationTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [sandwichConfirmed, setSandwichConfirmed] = useState(false);

  // Calculation
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load employee info
  useEffect(() => {
    async function load() {
      setLoadingEmployee(true);
      try {
        const [emp, bal] = await Promise.all([
          api.get<EmployeeSummary>(`/admin/users/${userId}`),
          api.get<LeaveBalance[]>(`/admin/leave/balance?user_id=${userId}`),
        ]);
        setEmployee(emp);
        setBalances(bal);
      } catch {
        setEmployee(null);
      } finally {
        setLoadingEmployee(false);
      }
    }
    load();
  }, [userId]);

  // Auto-calculate working days when dates change
  useEffect(() => {
    if (!leaveTypeId || !durationTypeId || !startDate || !endDate) {
      setCalc(null);
      return;
    }
    setCalcLoading(true);
    const timer = setTimeout(() => {
      api
        .post<CalcResult>('/leave/calculate', {
          leave_type_id: leaveTypeId,
          duration_type_id: durationTypeId,
          start_date: startDate,
          end_date: endDate,
          user_id: userId,
        })
        .then(setCalc)
        .catch(() => setCalc(null))
        .finally(() => setCalcLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [leaveTypeId, durationTypeId, startDate, endDate, userId]);

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await api.post('/admin/leave/requests', {
        user_id: userId,
        leave_type_id: leaveTypeId,
        duration_type_id: durationTypeId,
        start_date: startDate,
        end_date: endDate,
        reason,
        sandwich_confirmed: sandwichConfirmed,
        admin_notes: adminNotes || null,
      });
      toast('Leave submitted on behalf of employee.', 'success');
      router.push(`/admin/employees/${userId}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to submit leave. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (masterLoading || loadingEmployee) return <PageLoader />;

  if (!employee) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-base font-medium text-text-primary">Employee not found</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Unable to load employee information.
          </p>
          <Link href="/admin/employees" className="mt-4">
            <Button variant="secondary" size="sm">Back to Employees</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const selectedType = master.leave_types.find((t) => t.id === leaveTypeId);
  const typeBalance = balances.find((b) => b.leave_type.id === leaveTypeId);

  const canSubmit =
    leaveTypeId &&
    durationTypeId &&
    startDate &&
    endDate &&
    reason.length >= 10 &&
    calc &&
    (!calc.sandwich_detected || sandwichConfirmed);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={`/admin/employees/${userId}`}
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Employee
      </Link>

      <h1 className="text-2xl font-bold text-text-primary">Submit Leave on Behalf</h1>

      {/* Employee Banner */}
      <Card className="mt-4 mb-6 bg-neutral-bg">
        <div className="flex items-center gap-3">
          {employee.photo_url ? (
            <img
              src={employee.photo_url}
              alt={employee.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-semibold">
              {getInitials(employee.name)}
            </div>
          )}
          <div>
            <p className="font-medium text-text-primary">{employee.name}</p>
            <p className="text-sm text-text-secondary">
              {employee.email}
              {employee.department && ` - ${employee.department.label}`}
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </div>
      )}

      {/* Form */}
      <Card>
        <div className="space-y-5">
          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Leave Type <span className="text-danger">*</span>
            </label>
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
            {selectedType && typeBalance && (
              <p className="mt-2 text-xs text-text-secondary">
                Available: {typeBalance.available_days} / {typeBalance.total_days} days
              </p>
            )}
          </div>

          {/* Duration Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Duration <span className="text-danger">*</span>
            </label>
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
              <label className="block text-sm font-medium text-text-primary mb-1">
                From Date <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                To Date <span className="text-danger">*</span>
              </label>
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
          {calcLoading && (
            <p className="text-sm text-text-secondary">Calculating working days...</p>
          )}
          {calc && (
            <div className="rounded-lg bg-neutral-bg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Working days</span>
                <span className="font-medium text-text-primary">{calc.working_days}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Balance before</span>
                <span className="font-medium text-text-primary">{calc.balance_before} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Balance after</span>
                <span className="font-medium text-text-primary">{calc.balance_after} days</span>
              </div>
              {calc.sandwich_detected && (
                <div className="mt-2 rounded-lg bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e]">
                  Sandwich leave detected: {calc.sandwich_detail}
                </div>
              )}
            </div>
          )}

          {/* Sandwich Confirmation */}
          {calc?.sandwich_detected && (
            <label className="flex items-start gap-3 rounded-lg bg-[#fef3c7] p-3">
              <input
                type="checkbox"
                checked={sandwichConfirmed}
                onChange={(e) => setSandwichConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span className="text-sm text-[#92400e]">
                I confirm the sandwich leave policy has been explained to the employee and they agree
                to proceed.
              </span>
            </label>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Reason <span className="text-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Reason for leave (min 10 characters)"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="mt-1 text-xs text-danger">Minimum 10 characters required</p>
            )}
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Admin Notes <span className="text-xs text-text-secondary font-normal">(optional)</span>
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes visible only to admins"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Link href={`/admin/employees/${userId}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={!canSubmit}
            >
              Submit Leave on Behalf
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
