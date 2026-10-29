import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function StatusPopup({
  open,
  title,
  children,
  onClose,
  tone = "neutral",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  if (!open) return null;

  const toneBorder =
    tone === "success"
      ? "border-emerald-200"
      : tone === "warning"
        ? "border-amber-200"
        : tone === "error"
          ? "border-red-200"
          : "border-border";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg",
          toneBorder
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
