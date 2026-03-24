'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { formatDate, getInitials } from '@/lib/utils';

interface PendingUser {
  id: string;
  name: string;
  gmail: string;
  phone: string;
  dob: string;
  qualification: { label: string };
  gender: { label: string };
  roleType: { label: string };
  department: { label: string } | null;
  photo_url: string | null;
  resume_s3_key: string | null;
  created_at: string;
}

interface Manager {
  id: string;
  name: string;
  department: string;
}

export default function RegistrationsPage() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<PendingUser[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Activation form state per registration
  const [activateForm, setActivateForm] = useState<
    Record<string, { join_date: string; manager_id: string; is_manager: boolean }>
  >({});
  // Reject form state per registration
  const [rejectForm, setRejectForm] = useState<Record<string, { reason: string }>>({});
  // Loading states
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [regs, mgrs] = await Promise.all([
        api.get<PendingUser[]>('/admin/registrations/pending'),
        api.get<Manager[]>('/admin/users/managers'),
      ]);
      setRegistrations(regs);
      setManagers(mgrs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load registrations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function getActivateForm(id: string) {
    return activateForm[id] ?? { join_date: '', manager_id: '', is_manager: false };
  }

  function updateActivateForm(id: string, patch: Partial<{ join_date: string; manager_id: string; is_manager: boolean }>) {
    setActivateForm((prev) => ({
      ...prev,
      [id]: { ...getActivateForm(id), ...patch },
    }));
  }

  function getRejectForm(id: string) {
    return rejectForm[id] ?? { reason: '' };
  }

  function updateRejectForm(id: string, reason: string) {
    setRejectForm((prev) => ({
      ...prev,
      [id]: { reason },
    }));
  }

  async function handleActivate(id: string) {
    const form = getActivateForm(id);
    if (!form.join_date) {
      toast('Join date is required', 'error');
      return;
    }
    if (!form.manager_id) {
      toast('Please select a manager', 'error');
      return;
    }

    setActivatingId(id);
    try {
      await api.post(`/admin/registrations/${id}/activate`, {
        join_date: form.join_date,
        manager_id: form.manager_id,
        is_manager: form.is_manager,
      });
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      setExpandedId(null);
      toast('Registration activated successfully', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to activate registration', 'error');
    } finally {
      setActivatingId(null);
    }
  }

  async function handleReject(id: string) {
    const form = getRejectForm(id);
    if (!form.reason.trim()) {
      toast('Rejection reason is required', 'error');
      return;
    }

    setRejectingId(id);
    try {
      await api.post(`/admin/registrations/${id}/reject`, {
        reason: form.reason.trim(),
      });
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      setExpandedId(null);
      toast('Registration rejected', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed to reject registration', 'error');
    } finally {
      setRejectingId(null);
    }
  }

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-danger">{error}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Pending Registrations</h1>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-medium text-white">
          {registrations.length}
        </span>
      </div>

      {registrations.length === 0 ? (
        <EmptyState
          title="No pending registrations"
          description="All registrations have been processed. New registrations will appear here."
        />
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const isExpanded = expandedId === reg.id;
            const aForm = getActivateForm(reg.id);
            const rForm = getRejectForm(reg.id);

            return (
              <Card key={reg.id} className="overflow-hidden p-0">
                {/* Collapsed header - always visible */}
                <button
                  type="button"
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-neutral-bg"
                  onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                >
                  {/* Avatar */}
                  {reg.photo_url ? (
                    <img
                      src={reg.photo_url}
                      alt={reg.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(reg.name)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{reg.name}</p>
                    <p className="truncate text-xs text-text-secondary">{reg.gmail}</p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-text-secondary">Submitted</p>
                    <p className="text-sm text-text-primary">{formatDate(reg.created_at)}</p>
                  </div>

                  <svg
                    className={`h-5 w-5 shrink-0 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Details grid */}
                    <div className="grid grid-cols-1 gap-4 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
                      <DetailItem label="Phone" value={reg.phone} />
                      <DetailItem label="Date of Birth" value={formatDate(reg.dob)} />
                      <DetailItem label="Gender" value={reg.gender?.label ?? 'N/A'} />
                      <DetailItem label="Qualification" value={reg.qualification?.label ?? 'N/A'} />
                      <DetailItem label="Role Type" value={reg.roleType?.label ?? 'N/A'} />
                      <DetailItem label="Department" value={reg.department?.label ?? 'Not assigned'} />
                      <DetailItem label="Submitted" value={formatDate(reg.created_at)} />
                      {reg.resume_s3_key && (
                        <div>
                          <p className="text-xs font-medium text-text-secondary">Resume</p>
                          <p className="mt-0.5 text-sm text-primary">Uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Action panels */}
                    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                      {/* Activate panel */}
                      <div className="rounded-lg border border-border p-4">
                        <h4 className="mb-3 text-sm font-semibold text-text-primary">Activate Employee</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor={`join-date-${reg.id}`} className="mb-1 block text-xs font-medium text-text-secondary">
                              Join Date *
                            </label>
                            <input
                              id={`join-date-${reg.id}`}
                              type="date"
                              value={aForm.join_date}
                              onChange={(e) => updateActivateForm(reg.id, { join_date: e.target.value })}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`manager-${reg.id}`} className="mb-1 block text-xs font-medium text-text-secondary">
                              Reporting Manager *
                            </label>
                            <select
                              id={`manager-${reg.id}`}
                              value={aForm.manager_id}
                              onChange={(e) => updateActivateForm(reg.id, { manager_id: e.target.value })}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Select a manager</option>
                              {managers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}{m.department ? ` (${m.department})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={aForm.is_manager}
                              onChange={(e) => updateActivateForm(reg.id, { is_manager: e.target.checked })}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-text-primary">This employee is a manager</span>
                          </label>
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={activatingId === reg.id}
                            onClick={() => handleActivate(reg.id)}
                          >
                            Activate
                          </Button>
                        </div>
                      </div>

                      {/* Reject panel */}
                      <div className="rounded-lg border border-border p-4">
                        <h4 className="mb-3 text-sm font-semibold text-text-primary">Reject Registration</h4>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor={`reason-${reg.id}`} className="mb-1 block text-xs font-medium text-text-secondary">
                              Reason *
                            </label>
                            <textarea
                              id={`reason-${reg.id}`}
                              rows={3}
                              value={rForm.reason}
                              onChange={(e) => updateRejectForm(reg.id, e.target.value)}
                              placeholder="Provide a reason for rejection..."
                              className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={rejectingId === reg.id}
                            onClick={() => handleReject(reg.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm text-text-primary">{value}</p>
    </div>
  );
}
