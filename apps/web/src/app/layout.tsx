import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { QueryProvider } from '@/lib/query-client';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Software Planning Agent',
  description: '把模糊的软件想法，一步步变成能开工的计划',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
