import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  unavailable,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  unavailable?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">{label}</div>
            <div
              className={cn(
                "mt-1.5 text-2xl font-semibold tracking-tight",
                unavailable && "text-slate-300"
              )}
            >
              {unavailable ? "—" : value}
            </div>
            {hint && (
              <div className="mt-1 text-xs text-muted">
                {unavailable ? "Unavailable" : hint}
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-md bg-slate-50 p-2 text-slate-500">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
