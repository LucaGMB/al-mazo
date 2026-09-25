export default function StatBlock({
  value,
  label,
  large,
}: {
  value: string | number;
  label: string;
  large?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`font-bold text-ink ${large ? "text-base" : "text-sm"}`}>{value}</div>
      <div className="text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}
