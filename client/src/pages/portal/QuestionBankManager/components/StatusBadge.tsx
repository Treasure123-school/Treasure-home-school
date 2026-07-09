import { STATUS_META, DIFFICULTY_STYLE } from "../constants";

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${m.color}`}>
      {m.label}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const c = DIFFICULTY_STYLE[difficulty] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${c}`}>
      {difficulty}
    </span>
  );
}
