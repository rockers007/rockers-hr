'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface OvertimeRequest {
  id: string;
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

interface OvertimeSummary {
  year: number;
  total_approved_hours: number;
  total_paid_hours: number;
}

const paymentBadge = (ps: string) => {
  switch (ps) {
    case 'paid': return 'bg-[#d1fae5] text-[#065f46]';
    case 'comp_off': return 'bg-[#dbeafe] text-[#1e40af]';
    default: return 'bg-[#f1f5f9] text-[#475569]';
  }
};

export default function OvertimePage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState<OvertimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [reqs, sum] = await Promise.all([
        api.get<OvertimeRequest[]>('/overtime/my'),
        api.get<OvertimeSummary>('/overtime/my/summary'),
      ]);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setSummary(sum);
    } catch {
      toast('Failed to load overtime data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!date || !startTime || !endTime || !reason.trim()) {
      toast('Please fill all fields', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/overtime', {
        date,
        start_time: startTime,
        end_time: endTime,
        reason: reason.trim(),
      });
      toast('Overtime request submitted', 'success');
      setShowForm(false);
      setDate(''); setStartTime(''); setEndTime(''); setReason('');
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.delete(`/overtime/${id}`);
      toast('Overtime request cancelled', 'success');
      fetchData();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel';
      toast(msg, 'error');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Overtime</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Apply Overtime'}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-xs text-text-secondary">Total Approved Hours</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{summary.total_approved_hours}h</p>
          </Card>
          <Card>
            <p className="text-xs text-text-secondary">Paid Hours</p>
            <p className="text-2xl font-bold text-[#065f46] mt-1">{summary.total_paid_hours}h</p>
          </Card>
          <Card>
            <p className="text-xs text-text-secondary">Unpaid Hours</p>
            <p className="text-2xl font-bold text-[#92400e] mt-1">
              {(summary.total_approved_hours - summary.total_paid_hours).toFixed(1)}h
            </p>
          </Card>
        </div>
      )}

      {/* Apply Form */}
      {showForm && (
        <Card className="mb-6">
          <CardTitle>New Overtime Request</CardTitle>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Start Time</label>
              <input
                type="time"
                className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">End Time</label>
              <input
                type="time"
                className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <span className="text-sm text-text-secondary">
                {startTime && endTime ? `${calcHours(startTime, endTime)} hours` : ''}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-text-primary">Reason</label>
            <textarea
              className="w-full rounded-lg border border-border bg-neutral-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
              placeholder="Reason for overtime work..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              isLoading={submitting}
              disabled={submitting || !date || !startTime || !endTime || !reason.trim()}
              onClick={handleSubmit}
            >
              Submit Request
            </Button>
          </div>
        </Card>
      )}

      {/* Overtime History */}
      {requests.length === 0 ? (
        <EmptyState
          title="No overtime requests"
          description="You haven't submitted any overtime requests yet."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((ot) => (
            <Card key={ot.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-text-primary">
                      {formatOtDate(ot.date)}
                    </p>
                    <StatusBadge status={ot.status as any} />
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentBadge(ot.payment_status)}`}>
                      {ot.payment_status === 'comp_off' ? 'Comp Off' : ot.payment_status}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {ot.start_time.slice(0, 5)} – {ot.end_time.slice(0, 5)} &middot; <span className="font-medium">{Number(ot.hours)}h</span>
                  </p>
                  <p className="text-sm text-text-secondary">{ot.reason}</p>
                  {ot.admin_remarks && (
                    <p className="text-xs text-text-secondary italic">
                      Admin: {ot.admin_remarks}
                    </p>
                  )}
                </div>
                {ot.status === 'pending' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleCancel(ot.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function calcHours(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return '0';
  return (diff / 60).toFixed(1);
}

function formatOtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
