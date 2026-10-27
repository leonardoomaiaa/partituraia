import { Link, useLocation } from "@tanstack/react-router";
import { Music2, Gauge, Timer, FileText } from "lucide-react";

const TABS = [
  { to: "/", label: "Transpositor", icon: Music2 },
  { to: "/afinador", label: "Afinador", icon: Gauge },
  { to: "/metronomo", label: "Metrônomo", icon: Timer },
  { to: "/leitor", label: "Leitor", icon: FileText },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  if (!TABS.some((t) => t.to === pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition active:scale-95 ${active ? "text-primary" : "text-muted-foreground"}`}>
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active ? "bg-primary/15" : ""}`}><Icon className="h-5 w-5" /></span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
