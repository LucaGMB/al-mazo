"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Botones "prensados": bloque de color + borde grueso + escalón sólido abajo
// (sin blur) que se aplana al hacer click — así se arman los botones en
// Balatro. Sin redondear: los pixel art quieren esquina recta.
const variantClasses = {
  primary:
    "h-11 px-5 rounded-none border-[3px] border-[#241a44] font-display font-bold text-[14px] bg-accent text-[#171a35] shadow-[0_5px_0_0_var(--color-accent-hover)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-accent-hover)] transition-[transform,box-shadow,filter] duration-100",
  outline:
    "h-[38px] px-5 rounded-none border-[3px] border-medium font-display text-[11px] text-ink bg-surface shadow-[0_4px_0_0_var(--color-statusbar)] hover:border-accent hover:text-accent active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-statusbar)] transition-[transform,box-shadow,color,border-color] duration-100",
  cta: "h-[30px] px-4 rounded-none border-2 border-[#241a44] font-display font-bold text-[10px] bg-accent text-[#171a35] shadow-[0_3px_0_0_var(--color-accent-hover)] active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-accent-hover)] transition-[transform,box-shadow] duration-100",
  ghost:
    "h-[30px] px-3.5 rounded-none border-2 border-subtle font-display text-[10px] text-ink bg-surface shadow-[0_3px_0_0_var(--color-statusbar)] hover:border-accent active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-statusbar)] transition-[transform,box-shadow] duration-100",
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
