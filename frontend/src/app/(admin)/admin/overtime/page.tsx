'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface OvertimeUser {
  id: string;
  name: string;
  gmail: string;
}

interface OvertimeRecord {
  id: string;
  user: OvertimeUser;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  payment_status: 'unpaid' | 'paid' | 'comp_off';
  admin_remarks: string | null;
  reviewed_by: { name: string } | null;
  reviewed_at: string | null;
  created_at: string;
}

type TabFilter = 'pending' | 'approved' | 'declined' | 'all';

const paymentBadgeClass = (ps: string) => {
  switch (ps) {
    case 'paid': return 'bg-[#d1fae5] text-[#065f46]';
    case 'comp_off': return 'bg-[#dbeafe] text-[#1e40af]';
    default: return 'bg-[#f1f5f9] text-[#475569]';
  }
};

export default function AdminOvertimePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Decline inline
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineRemarks, setDeclineRemarks] = useState('');

  // Payment update
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('paid');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = tab === 'pending'
        ? '/admin/overtime/pending'
        : `/admin/overtime${tab !== 'all' ? `?status=${tab}` : ''}`;
      const data = await api.get<OvertimeRecord[]>(endpoint);
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load overtime data', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: string, employeeName: string) => {
    try {
      setActionLoading(id);
      await api.patch(`/admin/overtime/${id}/review`, {
        status: 'approved',
      });
      toast(`Overtime approved for ${employeeName}`, 'success');
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to approve';
      toast(msg, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: string, employeeName: string) => {
    try {
      setActionLoading(id);
      await api.patch(`/admin/overtime/${id}/review`, {
        status: 'declined',
        admin_remarks: declineRemarks.trim() || undefined,
      });
      toast(`Overtime declined for ${employeeName}`, 'success');
      setDecliningId(null);
      setDeclineRemarks('');
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to decline';
      toast(msg, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePaymentUpdate = async (id: string) => {
    try {
      setActionLoading(id);
      await api.patch(`/admin/overtime/${id}/payment`, {
        payment_status: paymentStatus,
        payment_remarks: paymentRemarks.trim() || undefined,
      });
      toast('Payment status updated', 'success');
      setPaymentId(null);
      setPaymentRemarks('');
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update payment';
      toast(msg, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'declined', label: 'Declined' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Overtime Management</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 rounded-lg bg-neutral-bg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : records.length === 0 ? (
        <EmptyState
          title={`No ${tab === 'all' ? '' : tab + ' '}overtime requests`}
          description="Overtime requests will appear here."
        />
      ) : (
        <div className="space-y-3">
          {records.map((ot) => {
            const isDeclining = decliningId === ot.id;
            const isPaymentEdit = paymentId === ot.id;
            const isActioning = actionLoading === ot.id;

            return (
              <Card key={ot.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary">{ot.user?.name ?? 'Unknown'}</p>
                      <span className="text-xs text-text-secondary">{ot.user?.gmail}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">
                        {formatOtDate(ot.date)}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {ot.start_time?.slice(0, 5)} – {ot.end_time?.slice(0, 5)}
                      </p>
                      <span className="text-sm font-semibold text-accent">{Number(ot.hours)}h</span>
                      <StatusBadge status={ot.status as any} />
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(ot.payment_status)}`}>
                        {ot.payment_status === 'comp_off' ? 'Comp Off' : ot.payment_status}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{ot.reason}</p>
                    {ot.admin_remarks && (
                      <p className="text-xs text-text-secondary italic">Remarks: {ot.admin_remarks}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {ot.status === 'pending' && !isDeclining && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={isActioning}
                          disabled={isActioning}
                          onClick={() => handleApprove(ot.id, ot.user?.name ?? 'Employee')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isActioning}
                          onClick={() => setDecliningId(ot.id)}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                    {ot.status === 'approved' && !isPaymentEdit && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setPaymentId(ot.id); setPaymentStatus(ot.payment_status); }}
                      >
                        Update Payment
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inline decline */}
                {isDeclining && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={2}
                      placeholder="Reason for declining (optional)..."
                      value={declineRemarks}
                      onChange={(e) => setDeclineRemarks(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" isLoading={isActioning} onClick={() => handleDecline(ot.id, ot.user?.name ?? 'Employee')}>
                        Confirm Decline
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setDecliningId(null); setDeclineRemarks(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inline payment update */}
                {isPaymentEdit && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2">
                    <div className="flex gap-3 items-center">
                      <select
                        className="rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="comp_off">Comp Off</option>
                      </select>
                      <input
                        type="text"
                        className="flex-1 rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Payment remarks (optional)"
                        value={paymentRemarks}
                        onChange={(e) => setPaymentRemarks(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" isLoading={isActioning} onClick={() => handlePaymentUpdate(ot.id)}>
                        Save
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setPaymentId(null); setPaymentRemarks(''); }}>
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

function formatOtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
