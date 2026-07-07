import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const buttonStyles = {
  base: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
  variants: {
    primary:
      'bg-slate-950 text-white shadow-sm shadow-slate-950/15 hover:bg-slate-800 focus-visible:outline-slate-950',
    secondary:
      'border border-slate-300 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-600',
    quiet: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-600',
    danger:
      'border border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 focus-visible:outline-red-600',
  },
};

export type ButtonVariant = keyof typeof buttonStyles.variants;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonStyles.base, buttonStyles.variants[variant], className)}
      type={type}
      {...props}
    />
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
}

export function ButtonLink({
  className,
  variant = 'primary',
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonStyles.base, buttonStyles.variants[variant], className)}
      href={href}
      {...props}
    >
      {children}
    </Link>
  );
}
