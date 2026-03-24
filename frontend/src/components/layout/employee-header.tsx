'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';

export function EmployeeHeader() {
  const { user } = useAuthStore();

  return (
    <header className="fixed top-0 left-64 right-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card-bg px-6">
      <div>
        <span className="text-base font-medium text-text-primary">
          Hi, {user?.name ?? 'User'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {/* TODO: unread count badge from /notifications/count */}
        </Link>

        <Link
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-sm font-medium"
        >
          {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </Link>
      </div>
    </header>
  );
}
