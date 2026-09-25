import { accountTint, cn } from "@lib";

interface AccountEdgeProps {
  color: string;
  /** Account email, announced to screen readers and shown on hover. */
  label: string;
  className?: string;
}

/**
 * Tells which account a message belongs to without looking like a status indicator.
 * Placed as the first child of a `relative isolate` item, it sits behind the item's content.
 */
export function AccountEdge({ color, label, className }: AccountEdgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("pointer-events-none absolute inset-0 -z-10 rounded-[inherit]", className)}
      style={{ background: accountTint(color) }}
    />
  );
}
