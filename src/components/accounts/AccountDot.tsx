import { cn } from "@lib";

interface AccountDotProps {
  color: string;
  className?: string;
}

/** Small colored marker identifying an account across the UI. */
export function AccountDot({ color, className }: AccountDotProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
