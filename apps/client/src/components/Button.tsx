"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Botones "prensados": panel pixel-art (assets reales, .btn-panel-* en
// globals.css) + escalón sólido abajo (sin blur) que se aplana al hacer
// click — así se arman los botones en Balatro.
const variantClasses = {
  primary:
    "btn-panel btn-panel-yellow h-11 px-5 border-[6px] font-display font-bold text-[14px] text-[#171a35] shadow-[0_5px_0_0_var(--color-accent-hover)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-accent-hover)] transition-[transform,box-shadow,filter] duration-100",
  outline:
    "btn-panel btn-panel-grey h-[38px] px-5 border-[6px] font-display text-[11px] text-ink-card shadow-[0_4px_0_0_var(--color-statusbar)] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-statusbar)] transition-[transform,box-shadow,filter] duration-100",
  cta: "btn-panel btn-panel-yellow h-[30px] px-4 border-[4px] font-display font-bold text-[10px] text-[#171a35] shadow-[0_3px_0_0_var(--color-accent-hover)] active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-accent-hover)] transition-[transform,box-shadow] duration-100",
  ghost:
    "btn-panel btn-panel-grey h-[30px] px-3.5 border-[4px] font-display text-[10px] text-ink-card shadow-[0_3px_0_0_var(--color-statusbar)] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-statusbar)] transition-[transform,box-shadow] duration-100",
  success:
    "btn-panel btn-panel-green h-10 px-4 border-[5px] font-display font-bold text-[12px] text-[#171a35] shadow-[0_4px_0_0_rgba(0,0,0,0.4)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.4)] transition-[transform,box-shadow,filter] duration-100",
  danger:
    "btn-panel btn-panel-red h-10 px-4 border-[5px] font-display font-bold text-[12px] text-[#171a35] shadow-[0_4px_0_0_rgba(0,0,0,0.4)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.4)] transition-[transform,box-shadow,filter] duration-100",
} as const;

type Variant = keyof typeof variantClasses;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  to?: string;
  children?: ReactNode;
}

export default function Button({
  variant = "primary",
  fullWidth,
  to,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer",
    variantClasses[variant],
    fullWidth ? "w-full" : "",
    className,
  ].join(" ");

  if (to) {
    return (
      <Link href={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
