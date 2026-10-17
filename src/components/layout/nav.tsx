"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, Inbox, LayoutDashboard, Loader2, LogIn, LogOut, Sparkles } from "lucide-react";
import type { AuthUser } from "@/infrastructure/auth/types";
import { cn } from "@/lib/styles";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/simulate", label: "Simulate", icon: Sparkles },
];

export function Nav({ engine, user }: { engine: string; user: AuthUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

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

        <div className="flex items-center gap-2">
          <span className="pill hidden bg-emerald-500/10 text-emerald-300 lg:inline-flex">
            <span className="animate-pulse-dot size-1.5 rounded-full bg-emerald-400" aria-hidden />
            engine · {engine}
          </span>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted sm:inline">{user.name}</span>
              <button
                type="button"
                onClick={signOut}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="size-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-white/12"
            >
              <LogIn className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
