"use client";

// Premium stat card: colored top-accent, icon tile, animated count-up value,
// percentage delta pill, optional sparkline, hover lift.
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Building2, Users, UserCheck, CalendarDays,
  IndianRupee, Star, Package, Scissors, Megaphone, Activity, BarChart3,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

// Icon registry — StatCard is a Client Component, so the server page passes an
// icon *name* (a string, which serializes) instead of a component reference.
const STAT_ICONS = {
  branches: Building2,
  workers: Users,
  customers: UserCheck,
  appointments: CalendarDays,
  revenue: IndianRupee,
  rating: Star,
  inventory: Package,
  services: Scissors,
  marketing: Megaphone,
  activity: Activity,
  chart: BarChart3,
  pending: CalendarClock,
  served: UserCheck,
} as const;
export type StatIcon = keyof typeof STAT_ICONS;

type Accent = "amber" | "emerald" | "sky" | "violet" | "rose" | "slate";

const ACCENTS: Record<Accent, { bar: string; iconWrap: string; icon: string; spark: string }> = {
  amber: { bar: "from-amber-400 to-amber-500", iconWrap: "bg-amber-50 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20", icon: "text-amber-600 dark:text-amber-400", spark: "#f59e0b" },
  emerald: { bar: "from-emerald-400 to-emerald-500", iconWrap: "bg-emerald-50 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-400", spark: "#10b981" },
  sky: { bar: "from-sky-400 to-sky-500", iconWrap: "bg-sky-50 ring-sky-100 dark:bg-sky-500/10 dark:ring-sky-500/20", icon: "text-sky-600 dark:text-sky-400", spark: "#0ea5e9" },
  violet: { bar: "from-violet-400 to-violet-500", iconWrap: "bg-violet-50 ring-violet-100 dark:bg-violet-500/10 dark:ring-violet-500/20", icon: "text-violet-600 dark:text-violet-400", spark: "#8b5cf6" },
  rose: { bar: "from-rose-400 to-rose-500", iconWrap: "bg-rose-50 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20", icon: "text-rose-600 dark:text-rose-400", spark: "#f43f5e" },
  slate: { bar: "from-slate-400 to-slate-500", iconWrap: "bg-slate-50 ring-slate-100 dark:bg-white/5 dark:ring-white/10", icon: "text-slate-600 dark:text-zinc-300", spark: "#64748b" },
};

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const id = React.useId();
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${30 - ((d - min) / span) * 26 - 2}`);
  const line = pts.join(" ");
  const area = `0,30 ${line} 100,30`;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "amber",
  delta,
  hint,
  format = "int",
  prefix,
  suffix,
  spark,
}: {
  label: string;
  value: number;
  icon?: StatIcon;
  accent?: Accent;
  delta?: number; // signed percentage, e.g. 12 or -4
  hint?: string;
  format?: "int" | "compact" | "inr";
  prefix?: string;
  suffix?: string;
  spark?: number[];
}) {
  const reduce = useReducedMotion();
  const a = ACCENTS[accent];
  const up = (delta ?? 0) >= 0;
  const Icon = icon ? STAT_ICONS[icon] : null;

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative h-full overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[box-shadow,background-color,border-color] duration-300 hover:shadow-[0_8px_24px_-8px_rgba(16,24,40,0.12)] dark:border-(--sa-border) dark:bg-(--sa-surface) dark:shadow-none dark:hover:shadow-none dark:hover:ring-1 dark:hover:ring-white/10"
    >
      {/* accent top border */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-linear-to-r", a.bar)} />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-medium text-gray-500 dark:text-(--sa-text-2)">{label}</p>
          {Icon && (
            <span className={cn("flex size-9 items-center justify-center rounded-lg ring-1", a.iconWrap)}>
              <Icon className={cn("size-4.5", a.icon)} />
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-(--sa-text)">
            <CountUp value={value} format={format} prefix={prefix} suffix={suffix} />
          </p>
          {typeof delta === "number" && (
            <span
              className={cn(
                "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                up ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
              )}
            >
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>

        {hint && <p className="mt-1 text-xs text-gray-400 dark:text-(--sa-muted)">{hint}</p>}

        {spark && spark.length > 1 && (
          <div className="mt-3 -mb-1">
            <MiniSpark data={spark} color={a.spark} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
