const tone: Record<string, string> = {
  active: "badge-success",
  graded: "badge-success",
  submitted: "badge-brand",
  invited: "badge-warning",
  not_started: "badge-warning",
  suspended: "badge-danger",
  archived: "badge",
  completed: "badge-success",
  draft: "badge",
  reopened: "badge-warning",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${tone[value] ?? ""}`}>{value.replaceAll("_", " ")}</span>;
}
