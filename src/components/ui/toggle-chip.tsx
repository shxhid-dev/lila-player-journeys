import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean;
  icon?: ReactNode;
  count?: number;
}

/** A pill toggle for multi-select filters. aria-pressed carries the state for screen readers. */
export function ToggleChip({
  pressed,
  icon,
  count,
  className,
  children,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none",
        pressed
          ? "border-accent/50 bg-accent/10 text-foreground"
          : "border-border text-muted hover:border-[#3a414d] hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && <span className="text-[10px] text-muted tabular-nums">{count}</span>}
    </button>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[11px] font-medium tracking-wider text-muted uppercase">{children}</h2>
      {aside}
    </div>
  );
}
