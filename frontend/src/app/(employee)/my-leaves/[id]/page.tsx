'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatDateRange } from '@/lib/utils';
import type { LeaveRequest } from '@/lib/types';

export default function LeaveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    api.get<LeaveRequest>(`/leave/requests/${id}`)
      .then(setRequest)
      .catch(() => router.replace('/my-leaves'))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.patch(`/leave/requests/${id}/cancel`);
      toast('Leave request cancelled. Balance restored.', 'success');
      router.push('/my-leaves');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to cancel', 'error');
    } finally {
      setCancelling(false);
      setShowCancelDialog(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!request) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-1.5 rounded-full"
            style={{ backgroundColor: request.leave_type.color }}
          />
          <div>
            <h1 className="text-xl font-bold text-text-primary">{request.leave_type.label}</h1>
            <p className="text-sm text-text-secondary">
              {formatDateRange(request.start_date, request.end_date)}
            </p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Submitted by admin banner */}
      {request.submitted_by_admin && (
        <div className="mb-4 rounded-lg bg-[#ede9fe] px-4 py-3 text-sm text-[#5b21b6]">
          Submitted by Admin: {request.submitted_by_admin.name}
        </div>
      )}

      {/* Cancelled banner */}
      {request.status === 'CANCELLED' && (
        <div className="mb-4 rounded-lg bg-[#f1f5f9] px-4 py-3 text-sm text-[#475569]">
          This leave request has been cancelled.
        </div>
      )}

      {/* Details Card */}
      <Card className="mb-6">
        <div className="space-y-3">
          <DetailRow label="Leave Type" value={request.leave_type.label} />
          <DetailRow label="Duration Type" value={request.duration_type.label} />
          <DetailRow label="Dates" value={formatDateRange(request.start_date, request.end_date)} />
          <DetailRow label="Working Days" value={`${request.working_days} day${request.working_days !== 1 ? 's' : ''}`} />
          <DetailRow label="Reason" value={request.reason} />
          {request.sandwich_flag && (
            <DetailRow label="Sandwich Leave" value="Yes — adjacent holidays/weekends included" />
          )}
        </div>
      </Card>

      {/* Approval Timeline */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Approval Timeline</h2>
        <div className="space-y-0">
          {/* Submitted */}
          <TimelineStep
            label="Submitted"
            timestamp={request.created_at}
            status="done"
            isLast={false}
            grayed={request.status === 'CANCELLED'}
          />

          {/* Level 1 — Manager */}
          {request.approvals.map((a) => {
            let status: 'done' | 'active' | 'pending' = 'pending';
            if (a.action === 'approved') status = 'done';
            else if (a.action === 'declined') status = 'done';
            else if (request.status === (a.level === 1 ? 'PENDING_L1' : 'PENDING_L2')) status = 'active';

            return (
              <TimelineStep
                key={a.level}
                label={`Level ${a.level} — ${a.level === 1 ? 'Manager' : 'HR'}: ${a.approver.name}`}
                timestamp={a.actioned_at}
                status={status}
                action={a.action}
                reason={a.action === 'declined' ? (a as { reason?: string }).reason : undefined}
                isLast={a.level === request.approvals.length}
                grayed={request.status === 'CANCELLED'}
              />
            );
          })}
        </div>
      </Card>

      {/* Cancel button */}
      {request.can_cancel && (
        <div className="flex justify-end">
          <Button variant="danger" onClick={() => setShowCancelDialog(true)}>
            Cancel Leave Request
          </Button>
        </div>
      )}

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Cancel Leave Request?</h2>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to cancel your {request.leave_type.label} leave from{' '}
              {formatDateRange(request.start_date, request.end_date)}? Your balance will be restored.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCancelDialog(false)}>
                Go Back
              </Button>
              <Button variant="danger" onClick={handleCancel} isLoading={cancelling}>
                Cancel Request
              </Button>
            </div>
          </Card>
        </div>
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

function TimelineStep({
  label,
  timestamp,
  status,
  action,
  reason,
  isLast,
  grayed,
}: {
  label: string;
  timestamp: string | null;
  status: 'done' | 'active' | 'pending';
  action?: string | null;
  reason?: string;
  isLast: boolean;
  grayed: boolean;
}) {
  const dotColor = grayed
    ? 'bg-gray-300'
    : status === 'done'
      ? action === 'declined'
        ? 'bg-danger'
        : 'bg-success'
      : status === 'active'
        ? 'bg-warning'
        : 'bg-gray-300';

  return (
    <div className={`flex gap-3 ${grayed ? 'opacity-50' : ''}`}>
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 rounded-full ${dotColor} mt-1.5`} />
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
      </div>
      <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {timestamp && (
          <p className="text-xs text-text-secondary">{formatDate(timestamp)}</p>
        )}
        {action && (
          <p className={`text-xs font-medium mt-0.5 ${action === 'declined' ? 'text-danger' : 'text-success'}`}>
            {action === 'approved' ? 'Approved' : 'Declined'}
          </p>
        )}
        {reason && (
          <div className="mt-1 rounded border border-danger/20 bg-[#fee2e2] px-3 py-2 text-xs text-[#991b1b]">
            {reason}
          </div>
        )}
      </div>
    </div>
  );
}
