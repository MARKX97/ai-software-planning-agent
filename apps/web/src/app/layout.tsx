import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Software Planning Agent',
  description: '将模糊的软件想法收敛为可执行的软件项目方案',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
