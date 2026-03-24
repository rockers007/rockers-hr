'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { MasterDataProvider } from '@/lib/master-data';
import { ToastProvider } from '@/components/ui/toast';
import { EmployeeSidebar } from '@/components/layout/employee-sidebar';
import { EmployeeHeader } from '@/components/layout/employee-header';
import { PageLoader } from '@/components/ui/spinner';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return null;

  return (
    <MasterDataProvider>
      <ToastProvider>
        <EmployeeSidebar />
        <EmployeeHeader />
        <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] p-6">
          {children}
        </main>
      </ToastProvider>
    </MasterDataProvider>
  );
}
