"use client";

import { Icon } from "@iconify/react";
import type { ChangeEventHandler } from "react";

export default function SearchInput({
  placeholder = "Buscar",
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-ink-faint pointer-events-none flex">
        <Icon icon="pixelarticons:search" width={16} height={16} />
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full h-[38px] rounded border border-subtle bg-statusbar text-ink text-[13px] pl-9 pr-3 placeholder:text-ink-faint focus:outline-none focus:border-accent"
      />
    </div>
  );
}
