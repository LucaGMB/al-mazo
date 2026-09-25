"use client";

export default function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const stateClasses = active
    ? "bg-accent border-accent text-[#171a35] font-bold hover:bg-accent-hover hover:border-accent-hover"
    : "border-medium text-outline hover:border-accent hover:text-accent";

  return (
    <button
      type="button"
      onClick={onClick}
 className={`shrink-0 h-7 px-3 border-2 text-xs whitespace-nowrap transition-colors duration-150 ${stateClasses}`}
    >
      {label}
    </button>
  );
}
