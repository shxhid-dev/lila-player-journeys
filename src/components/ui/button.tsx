import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "ghost" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  default: "bg-panel-raised text-foreground hover:bg-[#20252e] border border-border",
  ghost: "text-muted hover:text-foreground hover:bg-panel-raised",
  outline: "border border-border text-foreground hover:bg-panel-raised",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2 text-xs gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", active, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md font-medium transition-colors select-none",
        "focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        active && "border-accent/60 bg-accent/15 text-foreground",
        className,
      )}
      {...props}
    />
  );
});
