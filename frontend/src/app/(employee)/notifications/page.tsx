'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils';
import type { Notification } from '@/lib/types';

type FilterTab = 'all' | 'unread';

interface ApiNotification {
  id: string;
  rendered_title: string;
  rendered_body: string;
  is_read: boolean;
  leave_request_id: string | null;
  created_at: string;
}

interface PaginatedResponse {
  data: ApiNotification[];
  meta: { total: number; page: number; limit: number };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

function mapNotification(raw: ApiNotification): Notification {
  return {
    id: raw.id,
    title: raw.rendered_title,
    body: raw.rendered_body,
    is_read: raw.is_read,
    leave_request_id: raw.leave_request_id,
    created_at: raw.created_at,
  };
}

const LIMIT = 20;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean) => {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(LIMIT),
      });
      if (filter === 'unread') params.set('is_read', 'false');

      const res = await api.get<PaginatedResponse>(
        `/notifications?${params}`,
      );

      const mapped = res.data.map(mapNotification);
      setNotifications((prev) => (append ? [...prev, ...mapped] : mapped));
      setTotal(res.meta.total);
      setPage(pageNum);
    },
    [filter],
  );

  useEffect(() => {
    setLoading(true);
    fetchNotifications(1, false)
      .catch(() => {
        setNotifications([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [fetchNotifications]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchNotifications(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setMarkingRead(id);
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } finally {
      setMarkingRead(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const hasMore = notifications.length < total;
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            isLoading={markingAllRead}
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {(['all', 'unread'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {tab === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            title="No notifications"
            description={
              filter === 'unread'
                ? "You're all caught up! No unread notifications."
                : 'You have no notifications yet.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`relative ${
                !n.is_read ? 'border-l-4 border-l-accent bg-neutral-bg' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      !n.is_read
                        ? 'font-semibold text-text-primary'
                        : 'font-medium text-text-primary'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                    {n.body}
                  </p>
                  <p className="mt-2 text-xs text-text-secondary">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={markingRead === n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className="flex-shrink-0"
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                isLoading={loadingMore}
                onClick={handleLoadMore}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
