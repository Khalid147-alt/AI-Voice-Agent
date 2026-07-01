"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Campaigns
      </Link>
      <CampaignWizard />
    </div>
  );
}
