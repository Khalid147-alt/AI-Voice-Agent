"use client";

import { usePathname } from "next/navigation";

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
  const segment = pathname.split("/")[1] || "dashboard";
  const title = TITLES[segment] || "VoiceDesk";

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 md:px-8 border-b border-border bg-background/80 backdrop-blur">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
    </header>
  );
}
