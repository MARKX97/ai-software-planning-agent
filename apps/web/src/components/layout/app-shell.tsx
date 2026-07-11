'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/', label: '项目台' },
  { href: '/projects/new', label: '放进一个想法' },
  { href: '/projects', label: '所有项目' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh bg-[#f7f5ef] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="relative">
        <header className="sticky top-0 z-20 border-b border-slate-900/10 bg-[#f7f5ef]/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <Link className="group inline-flex w-fit items-center gap-3" href="/">
              <span className="grid size-10 place-items-center rounded-md border border-slate-900 bg-slate-950 text-sm font-bold text-white shadow-[4px_4px_0_#0f172a24]">
                AP
              </span>
              <span>
                <span className="block text-sm font-bold tracking-tight">AI Planning Agent</span>
                <span className="block text-xs text-slate-600">把点子带到开工前</span>
              </span>
            </Link>
            <nav aria-label="主导航" className="flex flex-wrap gap-2">
              {navigation.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    className={cn(
                      'min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
                      active && 'bg-white text-slate-950 shadow-sm',
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function PageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-900/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}
