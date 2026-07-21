// Shared presentational primitives. Light by default; each surface also carries
// `dark:` variants that resolve against the scoped `--sa-*` dashboard tokens, so
// these primitives inherit the active theme when rendered inside a `.dark`
// (#sa-dash-root) subtree and stay unchanged everywhere else.
import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Page header ──────────────────────────────────────────────────────────── */
export function PageHeader({
  title, subtitle, eyebrow, actions,
}: {
  title: string; subtitle?: string; eyebrow?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gray-400">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded border border-gray-200 bg-white dark:border-(--sa-border) dark:bg-(--sa-surface)", className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-(--sa-border)", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold text-gray-700 dark:text-(--sa-text)", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

/* ─── Stat card ────────────────────────────────────────────────────────────── */
export function StatCard({
  label, value, delta, hint, icon: Icon,
}: {
  label: string; value: string; delta?: { value: string; positive?: boolean };
  hint?: string; icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4 dark:border-(--sa-border) dark:bg-(--sa-surface)">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">{label}</p>
        {Icon && <Icon className="size-4 text-gray-400 dark:text-(--sa-muted)" />}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-(--sa-text)">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-(--sa-muted)">
        {delta && (
          <span className={cn("font-medium", delta.positive ? "text-green-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

/* ─── Badge ────────────────────────────────────────────────────────────────── */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneCls: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-(--sa-text-2)",
  success: "bg-green-50 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  danger:  "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  info:    "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  primary: "bg-gray-900 text-white dark:bg-white dark:text-gray-950",
};

export function Badge({
  children, tone = "neutral", className, style,
}: { children: React.ReactNode; tone?: Tone; className?: string; style?: React.CSSProperties }) {
  return (
    <span style={style} className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium", toneCls[tone], className)}>
      {children}
    </span>
  );
}

/* ─── Table ────────────────────────────────────────────────────────────────── */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead className={cn("border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-(--sa-border) dark:text-(--sa-text-2)", className)} {...props} />
  );
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-2.5 font-medium", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr className={cn("border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-(--sa-hover)", className)} {...props} />
  );
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

/* ─── Hero banner (simplified) ─────────────────────────────────────────────── */
export function HeroBanner({
  title, subtitle, eyebrow, stats, actions,
}: {
  title: string; highlight?: string; subtitle?: string; eyebrow?: string;
  actions?: React.ReactNode; stats?: { label: string; value: string }[];
}) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-6">
      {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      {stats && stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state / placeholder ────────────────────────────────────────────── */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400">{children}</p>;
}

/* ─── Sparkline ─────────────────────────────────────────────────────────────── */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${100 - ((d - min) / span) * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-8 w-full text-gray-400", className)}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
