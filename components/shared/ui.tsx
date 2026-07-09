// OWNER: Hemant | Shared presentational primitives — dark "Veloura" theme.
// Server-safe (no "use client"). Colours come from the panel palette (orange accent).
import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Page header ──────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-orange-500">
            <span className="h-px w-6 bg-orange-500/60" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Card ─────────────────────────────────────────────────────────────────── */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-2xl hover:shadow-black/40",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between border-b border-border px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-[0.8rem] font-semibold uppercase tracking-[0.14em]", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

/* ─── Stat card ────────────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="group relative overflow-hidden p-5 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-orange-500/50 hover:shadow-orange-500/10">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span className="flex size-9 items-center justify-center rounded-full bg-orange-500/12 text-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.15)] transition-transform group-hover:scale-110">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-[2rem] font-bold leading-none tracking-tight">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
              delta.positive
                ? "bg-emerald-500/12 text-emerald-400"
                : "bg-destructive/15 text-destructive"
            )}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

/* ─── Badge ────────────────────────────────────────────────────────────────── */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-white/8 text-muted-foreground",
  success: "bg-emerald-500/12 text-emerald-400",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-sky-500/12 text-sky-400",
  primary: "bg-orange-500/15 text-orange-400",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
        toneClasses[tone],
        className
      )}
    >
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
    <thead
      className={cn(
        "border-b border-border text-left text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("px-4 py-3 font-semibold", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr className={cn("border-b border-border/60 last:border-0 hover:bg-white/[0.03]", className)} {...props} />
  );
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

/* ─── Empty / placeholder note ─────────────────────────────────────────────── */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground/70">{children}</p>
  );
}

/* ─── Hero banner — bold first-impression header for dashboards ─────────────── */
export function HeroBanner({
  eyebrow,
  title,
  highlight,
  subtitle,
  actions,
  stats,
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  stats?: { label: string; value: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#171c2c] via-[#12151f] to-[#0c0e16] p-8 shadow-2xl shadow-black/40 sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-orange-500/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-orange-600/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          {eyebrow && (
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-orange-400">
              <span className="h-px w-6 bg-orange-500/70" />
              {eyebrow}
            </p>
          )}
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            {title}{" "}
            {highlight && (
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                {highlight}
              </span>
            )}
          </h1>
          {subtitle && <p className="max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
          {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
        </div>

        {stats && stats.length > 0 && (
          <div className="flex flex-wrap gap-6 sm:gap-8">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold tracking-tight text-orange-400 sm:text-4xl">{s.value}</p>
                <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sparkline — tiny inline trend line ───────────────────────────────────── */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * 100},${100 - ((d - min) / span) * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-10 w-full text-orange-500", className)}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
