import logoMark from "@assets/logo-mark.svg";
import { cn } from "@lib/utils";

interface LeariLogoProps {
  className?: string;
}

/** The leari mark: a Lear's macaw with open wings. */
export function LeariLogo({ className }: LeariLogoProps) {
  return <img src={logoMark} alt="leari" draggable={false} className={cn("size-16", className)} />;
}
