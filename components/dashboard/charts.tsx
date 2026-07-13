"use client";

// Recharts wrappers tuned for the Renzo dashboard: restrained ink axes, amber
// accent, soft grid, custom tooltips. Theme-aware — axis/grid/ink colours are
// props (SVG attributes can't read CSS vars), so they're picked from the live
// dashboard theme. All client-only and responsive.
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useDashTheme } from "./use-dash-theme";

// Light values are identical to the previous hard-coded colours, so the light
// theme is unchanged; dark values match the luxury palette.
function usePalette() {
  const dark = useDashTheme() === "dark";
  return {
    dark,
    axis: dark ? "#8a8a8a" : "#94a3b8",
    grid: dark ? "rgba(255,255,255,0.07)" : "#eef2f6",
    ink: dark ? "#fafafa" : "#0f172a",
    surface: dark ? "#18181b" : "#ffffff",
  };
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const int = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/* ── Tooltip shell ─────────────────────────────────────────────────────────── */
function TipShell({ label, children }: { label?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-(--sa-border) dark:bg-(--sa-elevated)">
      {label != null && <p className="mb-1 text-[11px] font-medium text-gray-400 dark:text-(--sa-muted)">{label}</p>}
      {children}
    </div>
  );
}

type TP = { active?: boolean; payload?: Array<{ value?: number; payload?: Record<string, unknown> }>; label?: string | number };

/* ── Area trend (single series) ───────────────────────────────────────────── */
export function AreaTrendChart({
  data,
  color = "#f59e0b",
  height = 260,
  valueKey = "value",
  labelKey = "label",
  money = false,
}: {
  data: Array<Record<string, number | string>>;
  color?: string;
  height?: number;
  valueKey?: string;
  labelKey?: string;
  money?: boolean;
}) {
  const { axis, grid } = usePalette();
  const fmt = money ? inr : int;
  const gid = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis
          dataKey={labelKey}
          tick={{ fill: axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          minTickGap={16}
        />
        <YAxis
          tick={{ fill: axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) => (money ? new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v as number) : int(v as number))}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
          content={(props) => {
            const { active, payload, label } = props as unknown as TP;
            return active && payload?.length ? (
              <TipShell label={label}>
                <p className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{fmt(Number(payload[0].value ?? 0))}</p>
              </TipShell>
            ) : null;
          }}
        />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#area-${gid})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Horizontal bar comparison (single measure) ──────────────────────────── */
export function BarCompareChart({
  data,
  color = "#f59e0b",
  height = 260,
  labelKey = "label",
  valueKey = "value",
}: {
  data: Array<Record<string, number | string>>;
  color?: string;
  height?: number;
  labelKey?: string;
  valueKey?: string;
}) {
  const { axis, grid, ink } = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fill: ink, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
          content={(props) => {
            const { active, payload, label } = props as unknown as TP;
            return active && payload?.length ? (
              <TipShell label={label}>
                <p className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{int(Number(payload[0].value ?? 0))}</p>
              </TipShell>
            ) : null;
          }}
        />
        <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Status donut (reserved status palette, legend + labels alongside) ─────── */
export type DonutSlice = { label: string; value: number; color: string };

export function StatusDonutChart({ data, height = 220 }: { data: DonutSlice[]; height?: number }) {
  const { dark, surface } = usePalette();
  const emptyColor = dark ? "#3f3f46" : "#e5e7eb";
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown.length ? shown : [{ label: "None", value: 1, color: emptyColor }]}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={shown.length > 1 ? 2 : 0}
              stroke={surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {(shown.length ? shown : [{ color: emptyColor }]).map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => {
                const { active, payload } = props as unknown as TP;
                return active && payload?.length ? (
                  <TipShell>
                    <p className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">
                      {String((payload[0].payload as { label?: string })?.label ?? "")}: {int(Number(payload[0].value ?? 0))}
                    </p>
                  </TipShell>
                ) : null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-(--sa-text)">{int(total)}</span>
          <span className="text-[11px] text-gray-400 dark:text-(--sa-muted)">Total</span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-600 dark:text-(--sa-text-2)">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
              {d.label}
            </span>
            <span className="font-medium tabular-nums text-gray-900 dark:text-(--sa-text)">
              {int(d.value)}
              <span className="ml-1 text-xs text-gray-400 dark:text-(--sa-muted)">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
