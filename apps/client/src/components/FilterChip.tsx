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
    ? "bg-accent border-accent text-white font-medium hover:bg-accent-hover hover:border-accent-hover"
    : "border-medium text-outline hover:border-accent hover:text-accent";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 h-7 px-3 rounded-full border text-xs whitespace-nowrap transition-colors duration-150 ${stateClasses}`}
    >
      {label}
    </button>
  );
}
