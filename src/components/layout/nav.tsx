"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, LayoutDashboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/styles";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/simulate", label: "Simulate", icon: Sparkles },
];

export function Nav({ engine }: { engine: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-md">
      <div className="shell flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-400 text-xs font-bold text-canvas">
            T
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Triagely</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
              Support Inbox Automation
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-white/8 text-ink" : "text-muted hover:bg-white/5 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <span className="pill bg-emerald-500/10 text-emerald-300">
            <span className="animate-pulse-dot size-1.5 rounded-full bg-emerald-400" aria-hidden />
            engine · {engine}
          </span>
        </div>
      </div>
    </header>
  );
}