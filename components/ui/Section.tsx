import { ChevronDown, type LucideIcon } from "lucide-react";

/** Small label over each block of a page, so "what is this group of buttons for?" is answered at a glance. */
export function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 px-4 text-xs font-bold text-ink-weak">
      <Icon size={14} color="var(--color-primary)" />
      {children}
    </h2>
  );
}

/**
 * Game-menu style fold: closed, it shows a title plus a one-line list of
 * what's inside, so the whole page reads as an index; tap to open. Native
 * <details> — no JS state, and it keeps working before hydration.
 */
export function MenuSection({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** What's inside, e.g. "シフト種別・必須の勤務" — readable without opening. */
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-[16px] border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-transform active:scale-[0.98] [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <Icon size={20} color="var(--color-primary)" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-bold text-ink">{title}</span>
          <span className="truncate text-xs text-ink-weak">{summary}</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-weakest transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2 border-t border-border px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
