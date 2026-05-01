'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/utils';

interface BackupItem {
  key: string;
  filename: string;
  size_bytes: number;
  backup_date: string;
  storage_class: string;
}

interface TriggerResult {
  status: 'success' | 'skipped';
  filename?: string;
  size_bytes?: number;
  message: string;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Route through the shared formatDateTime helper so every surface uses
// the same dd/MM/yyyy HH:mm presentation.
function formatDate(iso: string): string {
  return formatDateTime(iso);
}

export default function DatabaseBackupsPage() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [items, setItems] = useState<BackupItem[]>([]);
  const [error, setError] = useState('');
  const [triggerResult, setTriggerResult] = useState<TriggerResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ items: BackupItem[]; count: number }>(
        '/admin/backup/list',
      );
      setItems(data.items);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trigger = async () => {
    if (
      !window.confirm(
        'Run a database backup now? This takes 30–60 seconds depending on DB size.',
      )
    )
      return;
    setTriggering(true);
    setTriggerResult(null);
    setError('');
    try {
      const res = await api.post<TriggerResult>('/admin/backup/trigger');
      setTriggerResult(res);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setTriggering(false);
    }
  };

  // Trigger a direct authenticated download through fetch → Blob → anchor
  // (rather than a plain <a href>, because the endpoint requires JWT auth).
  const download = async (filename: string, asGzip: boolean) => {
    setDownloading(filename + (asGzip ? '-gz' : '-sql'));
    setError('');
    try {
      const qs = asGzip ? '?gz=1' : '';
      const token = localStorage.getItem('token');
      const res = await fetch(
        `/api/v1/admin/backup/download/${encodeURIComponent(filename)}${qs}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        throw new Error(`Download failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asGzip ? filename : filename.replace(/\.gz$/i, '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Database Backups
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Daily automatic backups run at 02:00 server time and are kept for 7
            days. You can also trigger a manual backup at any time. Download as{' '}
            <code className="rounded bg-gray-100 px-1">.sql</code> for direct
            import into pgAdmin (Query Tool → Open File → Execute), or keep the{' '}
            <code className="rounded bg-gray-100 px-1">.sql.gz</code> compressed
            copy.
          </p>
        </div>
        <Button onClick={trigger} isLoading={triggering} disabled={triggering}>
          {triggering ? 'Running…' : 'Run Backup Now'}
        </Button>
      </div>

      {triggerResult && (
        <div
          className={`rounded-lg p-3 text-sm ${
            triggerResult.status === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {triggerResult.message}
          {triggerResult.filename ? (
            <span className="ml-2 font-mono">
              · {triggerResult.filename} ·{' '}
              {formatSize(triggerResult.size_bytes ?? 0)}
            </span>
          ) : null}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-0">
        <div className="flex items-center justify-between px-6 pt-6">
          <CardTitle>Backups on S3</CardTitle>
          <button
            onClick={load}
            className="text-xs text-accent hover:underline"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            No backups found on S3. Click <strong>Run Backup Now</strong> to
            create one, or wait for the next scheduled 02:00 cron.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-6 py-3">Backup Date</th>
                  <th className="px-6 py-3">Filename</th>
                  <th className="px-6 py-3 text-right">Size</th>
                  <th className="px-6 py-3">Storage</th>
                  <th className="px-6 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((b) => {
                  const isDownloadingSql = downloading === b.filename + '-sql';
                  const isDownloadingGz = downloading === b.filename + '-gz';
                  return (
                    <tr key={b.key} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-text-primary">
                        {formatDate(b.backup_date)}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs">
                        {b.filename}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {formatSize(b.size_bytes)}
                      </td>
                      <td className="px-6 py-3 text-xs text-text-secondary">
                        {b.storage_class}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!!downloading}
                            isLoading={isDownloadingSql}
                            onClick={() => download(b.filename, false)}
                            title="Decompressed .sql — pgAdmin Query Tool → Open File"
                          >
                            .sql
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!downloading}
                            isLoading={isDownloadingGz}
                            onClick={() => download(b.filename, true)}
                            title="Original .sql.gz (compressed)"
                          >
                            .sql.gz
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">How to restore in pgAdmin</h3>
        <ol className="mt-2 ml-5 list-decimal space-y-1 text-sm text-text-secondary">
          <li>
            Download the <code>.sql</code> version (already decompressed).
          </li>
          <li>
            Open pgAdmin → select the target database → <em>Query Tool</em> →{' '}
            <em>Open File</em> → select the downloaded <code>.sql</code>.
          </li>
          <li>
            Click <em>Execute</em> (or press F5). The file contains{' '}
            <code>pg_dump</code> output with <code>--no-owner --no-privileges</code>{' '}
            so it will apply cleanly to a fresh database.
          </li>
          <li>
            Alternative CLI: <code>psql &lt; backup.sql</code> after setting{' '}
            <code>PGDATABASE</code>/<code>PGUSER</code>.
          </li>
        </ol>
      </Card>
    </div>
  );
}
