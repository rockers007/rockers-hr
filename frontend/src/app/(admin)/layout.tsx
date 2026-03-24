'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { MasterDataProvider } from '@/lib/master-data';
import { ToastProvider } from '@/components/ui/toast';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { PageLoader } from '@/components/ui/spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isLoading, initAuth } = useAuthStore();

  // Allow /admin/login through without auth
  const isLoginPage = pathname === '/admin/login';

  // Restore auth state from stored token on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isLoading && !isAdmin && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [isLoading, isAdmin, isLoginPage, router]);

  if (isLoginPage) {
    return (
      <ToastProvider>
        {children}
      </ToastProvider>
    );
  }

  if (isLoading) return <PageLoader />;
  if (!isAdmin) return null;

  return (
    <MasterDataProvider>
      <ToastProvider>
        <AdminSidebar />
        <AdminHeader />
        <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] p-6">
          {children}
        </main>
      </ToastProvider>
    </MasterDataProvider>
  );
}
