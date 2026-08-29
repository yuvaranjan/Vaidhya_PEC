/**
 * Scaffold marker. Delete this component's usage as each screen gets built —
 * when no page imports it any more, the portal lane is done.
 */
export function LanePlaceholder({
  lane,
  task,
  title,
  children,
}: {
  lane: string;
  task: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-medium text-primary-600">
          {lane} · {task}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 text-muted">{children}</div>
      </div>
    </main>
  );
}
