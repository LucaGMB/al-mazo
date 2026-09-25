"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const variantClasses = {
  primary: "h-11 px-5 rounded font-bold text-[15px] bg-accent text-white hover:bg-accent-hover",
  outline:
    "h-[38px] px-5 rounded font-medium text-[13px] border border-medium text-outline hover:border-accent hover:text-accent",
  cta: "h-[30px] px-4 rounded-full font-bold text-[11px] bg-accent text-white shadow-[0_0_10px_rgba(32,168,216,0.5)] hover:bg-accent-hover",
  ghost:
    "h-[30px] px-3.5 rounded-full font-normal text-[11px] bg-subtle border border-medium text-ink hover:bg-medium",
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
    "inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors duration-150",
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
