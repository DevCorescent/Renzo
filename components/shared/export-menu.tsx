"use client";

// Export button + popover listing downloadable reports, each as CSV or PDF.
// Shared by the branch Sheet and Reports pages. Pass `header` to put extra
// controls (e.g. a period picker) at the top of the popover.

import * as React from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

export type ExportFormat = "csv" | "pdf";

export interface ExportOption<Id extends string> {
  id: Id;
  name: string;
  description: string;
}

export function ExportMenu<Id extends string>({
  options,
  onExport,
  header,
  subtitle = "Uses what you have on screen.",
}: {
  options: ExportOption<Id>[];
  onExport: (id: Id, format: ExportFormat) => void | Promise<void>;
  header?: React.ReactNode;
  subtitle?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey  = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function run(id: Id, format: ExportFormat) {
    setBusy(`${id}:${format}`);
    setError(null);
    try {
      await onExport(id, format);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const fmtBtn = "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        <Download className="h-3.5 w-3.5" /> Export
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[400px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <div className="text-sm font-semibold text-gray-900">Download a report</div>
            <div className="text-[11px] text-gray-500">{subtitle}</div>
            {header && <div className="mt-2.5">{header}</div>}
          </div>
          <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
            {options.map((o, i) => (
              <li key={o.id} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-gray-50" : ""}`}>
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900">{o.name}</div>
                  <div className="text-[11px] leading-snug text-gray-500">{o.description}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {(["csv", "pdf"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => run(o.id, f)}
                      disabled={busy !== null}
                      className={fmtBtn}
                      title={`${o.name} as ${f === "csv" ? "CSV (Excel)" : "PDF"}`}
                    >
                      {busy === `${o.id}:${f}`
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : f === "pdf" && <FileText className="h-3 w-3" />}
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 px-4 py-2 text-[10px] text-gray-400">
            {error
              ? <span className="text-red-600">{error}</span>
              : "CSV opens in Excel · PDF is ready to print or share."}
          </div>
        </div>
      )}
    </div>
  );
}
