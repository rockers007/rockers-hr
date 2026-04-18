'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDateRange } from '@/lib/utils';

// The API returns LeaveApproval objects with nested leave_request
interface RawApproval {
  id: string;
  level: number;
  action: string | null;
  escalated: boolean;
  leave_request: {
    id: string;
    start_date: string;
    end_date: string;
    working_days: number;
    reason: string;
    status: string;
    sandwich_flag: boolean;
    created_at: string;
    user: { id: string; name: string; gmail: string };
    leave_type: { id: string; label: string; color: string };
    duration_type: { id: string; label: string };
  };
}

interface PendingApproval {
  approval_id: string;
  user: { name: string; email: string };
  leave_type: { label: string; color: string };
  duration_type: { label: string };
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: string;
  sandwich_flag: boolean;
}

function mapApproval(raw: RawApproval): PendingApproval {
  const lr = raw.leave_request;
  return {
    approval_id: raw.id,
    user: { name: lr.user?.name ?? 'Unknown', email: lr.user?.gmail ?? '' },
    leave_type: { label: lr.leave_type?.label ?? 'Leave', color: lr.leave_type?.color ?? '#6b7280' },
    duration_type: { label: lr.duration_type?.label ?? 'Full Day' },
    start_date: lr.start_date,
    end_date: lr.end_date,
    working_days: lr.working_days,
    reason: lr.reason,
    status: lr.status,
    sandwich_flag: lr.sandwich_flag,
  };
}

export default function ManagerApprovalsPage() {
  const [requests, setRequests] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await api.get<RawApproval[]>('/manager/approvals/pending');
      setRequests(raw.map(mapApproval));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (approvalId: string) => {
    try {
      setActionLoading(approvalId);
      await api.post(`/manager/approvals/${approvalId}/approve`);
      setRequests((prev) => prev.filter((r) => r.approval_id !== approvalId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (approvalId: string) => {
    if (!declineReason.trim()) {
      setError('Please provide a reason for declining.');
      return;
    }
    try {
      setActionLoading(approvalId);
      await api.post(`/manager/approvals/${approvalId}/decline`, { reason: declineReason });
      setRequests((prev) => prev.filter((r) => r.approval_id !== approvalId));
      setDeclineId(null);
      setDeclineReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to decline');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Team Leave Approvals</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            title="No pending approvals"
            description="There are no leave requests waiting for your approval."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.approval_id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-10 w-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: req.leave_type.color }}
                  />
                  <div>
                    <p className="font-semibold text-text-primary">{req.user.name}</p>
                    <p className="text-sm text-text-secondary">{req.user.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-text-primary">
                        {req.leave_type.label}
                      </span>
                      <span className="text-text-secondary">·</span>
                      <span className="text-text-secondary">
                        {req.duration_type.label}
                      </span>
                      <span className="text-text-secondary">·</span>
                      <span className="text-text-secondary">
                        {formatDateRange(req.start_date, req.end_date)}
                      </span>
                      <span className="text-text-secondary">·</span>
                      <span className="font-medium text-text-primary">{req.working_days} day(s)</span>
                    </div>
                    {req.reason && (
                      <p className="mt-2 text-sm text-text-secondary italic">
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    )}
                    {req.sandwich_flag && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Sandwich Leave
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <StatusBadge status={req.status} />
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(req.approval_id)}
                      isLoading={actionLoading === req.approval_id}
                      disabled={actionLoading !== null}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeclineId(req.approval_id)}
                      disabled={actionLoading !== null}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </div>

              {/* Decline reason input */}
              {declineId === req.approval_id && (
                <div className="mt-4 border-t border-border pt-4">
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Reason for declining
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Provide a reason..."
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDecline(req.approval_id)}
                      isLoading={actionLoading === req.approval_id}
                    >
                      Confirm Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setDeclineId(null); setDeclineReason(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
