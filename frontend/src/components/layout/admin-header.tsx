'use client';

import { useAuthStore } from '@/lib/auth-store';

export function AdminHeader() {
  const { adminUser, logout } = useAuthStore();

  return (
    <header className="fixed top-0 left-64 right-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card-bg px-6">
      <div>
        <span className="text-sm font-medium text-text-secondary">Admin Panel</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">{adminUser?.name ?? 'Admin'}</span>
        <button
          onClick={() => logout()}
          className="text-sm font-medium text-danger hover:underline"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
