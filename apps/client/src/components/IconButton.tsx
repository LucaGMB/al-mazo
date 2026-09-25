"use client";

import { Icon } from "@iconify/react";
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  size?: number;
  active?: boolean;
}

export default function IconButton({
  icon,
  size = 18,
  active,
  className = "",
  ...props
}: IconButtonProps) {
  const stateClasses = active
    ? "border-accent text-accent bg-accent/10"
    : "border-subtle text-ink-faint hover:bg-subtle hover:border-medium hover:text-ink";

  return (
    <button
      type="button"
 className={`inline-flex items-center justify-center w-10 h-10 border-2 transition-colors duration-150 ${stateClasses} ${className}`}
      {...props}
    >
      <Icon icon={`pixelarticons:${icon}`} width={size} height={size} />
    </button>
  );
}
