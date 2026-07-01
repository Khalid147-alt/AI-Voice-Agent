"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import type { AppSettings } from "@/types";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  agents: "AI Agents",
  calls: "Calls",
  campaigns: "Campaigns",
  contacts: "Contacts",
  analytics: "Analytics",
};

export function TopBar() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const segment = pathname.split("/")[1] || "dashboard";
  const title = TITLES[segment] || "VoiceDesk";

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-background/80 backdrop-blur">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {settings?.demo_mode && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
          <span className="h-2 w-2 rounded-full bg-warning animate-pulse-dot" />
          <span className="hidden sm:inline">
            Demo Mode — Connect your VAPI key to make real calls
          </span>
          <span className="sm:hidden">Demo Mode</span>
        </div>
      )}
    </header>
  );
}
