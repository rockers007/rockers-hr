'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils';

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  method: string | null;
  entity_type: string;
  entity_id: string | null;
  on_behalf_of: string | null;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (entityType) params.set('entity_type', entityType);
      if (action) params.set('action', action);

      const res = await api.getWithMeta<AuditEntry[]>(`/admin/audit-log?${params}`);
      setEntries(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Audit Log</h1>
      <p className="mt-1 text-sm text-text-secondary">All system write operations</p>

      <div className="mt-4 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Filter by entity type..."
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="rounded-lg border border-border px-3 py-2 text-sm w-48"
        />
        <input
          type="text"
          placeholder="Filter by action..."
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="rounded-lg border border-border px-3 py-2 text-sm w-48"
        />
      </div>

      {loading ? (
        <PageLoader />
      ) : entries.length === 0 ? (
        <Card className="mt-4">
          <EmptyState title="No audit log entries" description="No write operations have been recorded yet." />
        </Card>
      ) : (
        <>
          <Card className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-neutral-bg/50">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <>
                    <tr key={e.id} className="border-b border-border hover:bg-neutral-bg/30">
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-xs">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary text-xs">
                        {e.entity_type}
                        {e.entity_id && <span className="text-text-secondary ml-1">({e.entity_id.slice(0, 8)}...)</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{e.method ?? '-'}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{e.actor_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{e.ip_address ?? '-'}</td>
                      <td className="px-4 py-3">
                        {(e.before_state || e.after_state) && (
                          <button
                            className="text-xs text-accent hover:underline"
                            onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                          >
                            {expandedId === e.id ? 'Hide' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === e.id && (
                      <tr key={`${e.id}-detail`} className="border-b border-border bg-neutral-bg/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {e.before_state && (
                              <div>
                                <p className="font-medium text-text-secondary mb-1">Before</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-40 border border-border">
                                  {JSON.stringify(e.before_state, null, 2)}
                                </pre>
                              </div>
                            )}
                            {e.after_state && (
                              <div>
                                <p className="font-medium text-text-secondary mb-1">After</p>
                                <pre className="bg-white rounded p-2 overflow-auto max-h-40 border border-border">
                                  {JSON.stringify(e.after_state, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
