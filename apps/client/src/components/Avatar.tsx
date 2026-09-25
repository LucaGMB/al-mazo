const sizeClasses: Record<number, string> = {
  32: "w-8 h-8",
  72: "w-[72px] h-[72px]",
};

export default function Avatar({
  size = 32,
  className = "",
}: {
  size?: 32 | 72;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 rounded-full bg-subtle border border-medium ${sizeClasses[size] ?? ""} ${className}`}
    />
  );
}
