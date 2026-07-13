"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Phone,
  Megaphone,
  Users,
  BarChart2,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [vapiConnected, setVapiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setVapiConnected(s.vapi_connected))
      .catch(() => setVapiConnected(false));
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[240px] flex-col border-r border-border bg-surface z-30">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">VoiceDesk</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                vapiConnected ? "bg-success" : "bg-warning animate-pulse-dot"
              )}
            />
            {vapiConnected === null
              ? "Connecting…"
              : vapiConnected
              ? "VAPI Connected"
              : "VAPI Not Connected"}
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-surface h-16">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
                active ? "text-accent" : "text-text-secondary"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
