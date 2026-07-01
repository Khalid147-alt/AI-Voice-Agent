import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/shared/Toast";

export const metadata: Metadata = {
  title: "VoiceDesk — AI Voice Agent Platform",
  description:
    "Create AI phone agents, launch call campaigns, and monitor live calls.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary">
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-[240px] min-w-0">
              <TopBar />
              <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">{children}</main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
