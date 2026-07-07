import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  active: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export type BadgeVariant = keyof typeof variants;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2.5 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function statusVariant(status: string): BadgeVariant {
  if (status === 'completed' || status === 'success') {
    return 'success';
  }
  if (status === 'failed' || status === 'timeout' || status === 'rate_limited') {
    return 'danger';
  }
  if (status === 'active' || status === 'running') {
    return 'active';
  }
  return 'neutral';
}
