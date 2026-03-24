'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatDateRange } from '@/lib/utils';

interface ApprovalUser {
  id: string;
  name: string;
  gmail: string;
}

interface LeaveType {
  id: string;
  label: string;
  color: string;
}

interface DurationType {
  label: string;
}

interface LeaveRequest {
  id: string;
  user: ApprovalUser;
  leaveType: LeaveType;
  durationType: DurationType;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  sandwich_flag: boolean;
  status: string;
}

interface Approval {
  id: string;
  leaveRequest: LeaveRequest;
  sla_deadline: string;
  created_at: string;
}

function getTimeRemaining(deadline: string): { label: string; isUrgent: boolean; isOverdue: boolean } {
  const now = new Date();
  const target = new Date(deadline);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { label: 'Overdue', isUrgent: true, isOverdue: true };
  }

  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;

  if (diffHours > 0) {
    return {
      label: `${diffHours}h ${remainingMin}m remaining`,
      isUrgent: diffHours < 1,
      isOverdue: false,
    };
  }

  return {
    label: `${diffMin}m remaining`,
    isUrgent: true,
    isOverdue: false,
  };
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Approval[]>('/admin/approvals/pending');
      setApprovals(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load approvals';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (approvalId: string, employeeName: string) => {
    try {
      setActionLoadingId(approvalId);
      await api.post(`/admin/approvals/${approvalId}/approve`);
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      toast(`Leave approved for ${employeeName}`, 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to approve leave';
      toast(message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineSubmit = async (approvalId: string, employeeName: string) => {
    if (!declineReason.trim()) {
      toast('Please provide a reason for declining', 'error');
      return;
    }

    try {
      setActionLoadingId(approvalId);
      await api.post(`/admin/approvals/${approvalId}/decline`, { reason: declineReason.trim() });
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      setDecliningId(null);
      setDeclineReason('');
      toast(`Leave declined for ${employeeName}`, 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to decline leave';
      toast(message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineCancel = () => {
    setDecliningId(null);
    setDeclineReason('');
  };

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-danger mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchApprovals}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Pending Approvals</h1>
        <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
          {approvals.length}
        </span>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="All leave requests have been processed. New requests will appear here when they reach L2 approval."
        />
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const { leaveRequest } = approval;
            const { user, leaveType, durationType } = leaveRequest;
            const sla = getTimeRemaining(approval.sla_deadline);
            const isDeclining = decliningId === approval.id;
            const isActioning = actionLoadingId === approval.id;

            return (
              <Card key={approval.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: details */}
                  <div className="min-w-0 flex-1 space-y-3">
                    {/* Employee info */}
                    <div>
                      <p className="text-base font-semibold text-text-primary">{user.name}</p>
                      <p className="text-sm text-text-secondary">{user.gmail}</p>
                    </div>

                    {/* Leave info row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: leaveType.color }}
                        />
                        <span className="font-medium text-text-primary">{leaveType.label}</span>
                      </span>
                      <span className="text-text-secondary">
                        {formatDateRange(leaveRequest.start_date, leaveRequest.end_date)}
                      </span>
                      <span className="text-text-secondary">
                        {leaveRequest.working_days} working day{leaveRequest.working_days !== 1 ? 's' : ''}
                      </span>
                      <span className="text-text-secondary">({durationType.label})</span>
                      <StatusBadge status={leaveRequest.status as any} />
                    </div>

                    {/* Reason */}
                    {leaveRequest.reason && (
                      <p className="text-sm text-text-secondary line-clamp-2">
                        {leaveRequest.reason}
                      </p>
                    )}

                    {/* Flags row */}
                    <div className="flex flex-wrap items-center gap-3">
                      {leaveRequest.sandwich_flag && (
                        <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#92400e]">
                          Sandwich Leave Detected
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium ${
                          sla.isOverdue
                            ? 'text-danger'
                            : sla.isUrgent
                              ? 'text-[#d97706]'
                              : 'text-text-secondary'
                        }`}
                      >
                        SLA: {sla.label}
                      </span>
                    </div>
                  </div>

                  {/* Right: actions */}
                  {!isDeclining && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isActioning}
                        disabled={isActioning}
                        onClick={() => handleApprove(approval.id, user.name)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isActioning}
                        onClick={() => setDecliningId(approval.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline decline form */}
                {isDeclining && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <label className="block text-sm font-medium text-text-primary">
                      Reason for declining
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={3}
                      placeholder="Provide a reason for declining this leave request..."
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isActioning}
                        disabled={isActioning || !declineReason.trim()}
                        onClick={() => handleDeclineSubmit(approval.id, user.name)}
                      >
                        Confirm Decline
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isActioning}
                        onClick={handleDeclineCancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
