import { cn } from "@lib";

interface AccountEdgeProps {
  color: string;
  /** Account email, announced to screen readers and shown on hover. */
  label: string;
  className?: string;
}

/**
 * Thin bar on an item's left edge in the account's color, fading out at both ends:
 * tells which account a message belongs to without looking like a status indicator.
 */
export function AccountEdge({ color, label, className }: AccountEdgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("absolute inset-y-1.5 left-0 w-[3px] rounded-full", className)}
      style={{
        background: `linear-gradient(to bottom, transparent, ${color} 30%, ${color} 70%, transparent)`,
      }}
    />
  );
}
