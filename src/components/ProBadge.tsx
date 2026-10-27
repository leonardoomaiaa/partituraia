import { Sparkles } from "lucide-react";

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-primary/45 bg-gold px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground shadow-glow ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      PRO
    </span>
  );
}
