import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TopProgressBar } from '@/components/ui/top-progress-bar';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Rockers HR — HR Management System',
  description: 'Rockers Technologies — HR Management System',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/images/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/images/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {/*
          Global API loading indicator. Activates whenever any
          api.* call is in flight so users get visible feedback the
          moment they click a button — no per-form wiring needed.
          See components/ui/top-progress-bar.tsx for the easing logic.
        */}
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}
