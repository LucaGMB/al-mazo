"use client";

import { Icon } from "@iconify/react";

export default function MenuListItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-12 flex items-center gap-3 border-0 border-b border-subtle bg-transparent text-[13px] text-left cursor-pointer hover:bg-surface ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      <Icon icon={`pixelarticons:${icon}`} width={20} height={20} />
      <span>{label}</span>
    </button>
  );
}
