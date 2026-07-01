import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
      <Loader2 className={cn("h-5 w-5 animate-spin", className)} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}
