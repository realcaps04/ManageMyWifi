import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{description}</p>
        <p className="mt-4 text-xs text-slate-400">
          Scaffolded for milestone 1 — full functionality lands after device
          discovery is verified.
        </p>
      </CardContent>
    </Card>
  );
}
