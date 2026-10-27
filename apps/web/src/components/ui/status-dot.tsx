import { cn } from "@/lib/utils";

const colors = {
  online: "bg-emerald-500",
  offline: "bg-slate-300",
  degraded: "bg-amber-500",
  connected: "bg-emerald-500",
  disconnected: "bg-red-500",
  unknown: "bg-slate-300",
};

export function StatusDot({
  status,
  className,
}: {
  status: keyof typeof colors | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        colors[status as keyof typeof colors] || colors.unknown,
        className
      )}
    />
  );
}
