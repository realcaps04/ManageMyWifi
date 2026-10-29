import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select or type…",
  emptyLabel = "No matches",
  allowCreate = true,
  createLabel = (q: string) => `Use “${q}”`,
  disabled,
  required,
  name,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  allowCreate?: boolean;
  createLabel?: (query: string) => string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [value]);

  const uniqueOptions = useMemo(
    () =>
      [...new Set(options.map((o) => o.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((o) => o.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  const exactMatch = uniqueOptions.some(
    (o) => o.toLowerCase() === query.trim().toLowerCase()
  );
  const canCreate =
    allowCreate && query.trim().length > 0 && !exactMatch;

  const items = useMemo(() => {
    const rows: Array<{ type: "option" | "create"; label: string; value: string }> =
      filtered.map((o) => ({ type: "option", label: o, value: o }));
    if (canCreate) {
      rows.push({
        type: "create",
        label: createLabel(query.trim()),
        value: query.trim(),
      });
    }
    return rows;
  }, [filtered, canCreate, createLabel, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function select(next: string) {
    onChange(next);
    setQuery(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) select(item.value);
      else if (allowCreate && query.trim()) select(query.trim());
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          name={name}
          required={required}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 w-full rounded-md border border-border bg-white py-2 pl-8 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-50"
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          aria-label="Toggle options"
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li>
          )}
          {items.map((item, index) => {
            const selected = value === item.value;
            const active = index === activeIndex;
            return (
              <li key={`${item.type}-${item.value}`} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-50",
                    selected && "font-medium"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(item.value)}
                >
                  {item.type === "create" ? (
                    <Plus className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  ) : selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
