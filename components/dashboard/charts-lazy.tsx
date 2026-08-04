"use client";

// Lightweight client-side chart renderers. These keep the dashboard visuals
// intact without relying on the lazy Recharts bundle that is currently failing
// in this environment during route render.
import * as React from "react";
import { useDashTheme } from "./use-dash-theme";

export type DonutSlice = { label: string; value: number; color: string };

type ChartDatum = Record<string, number | string>;

function usePalette() {
  const dark = useDashTheme() === "dark";
  return {
    axis: dark ? "#8a8a8a" : "#94a3b8",
    dark: dark ? "#fafafa" : "#0f172a",
    grid: dark ? "rgba(255,255,255,0.07)" : "#eef2f6",
    ink: dark ? "#fafafa" : "#0f172a",
    surface: dark ? "#18181b" : "#ffffff",
  };
}

function int(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function AreaTrendChart({
  data,
  color = "#f59e0b",
  height = 260,
  valueKey = "value",
  labelKey = "label",
  money = false,
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
  valueKey?: string;
  labelKey?: string;
  money?: boolean;
}) {
  const { grid, ink } = usePalette();
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  });

  const fmt = money ? inr : int;
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-elevated)">
      <svg viewBox="0 0 100 100" className="w-full" style={{ height }} aria-label="Trend chart">
        <rect x="0" y="0" width="100" height="100" fill="none" />
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1="0" y1={10 + i * 20} x2="100" y2={10 + i * 20} stroke={grid} strokeWidth="0.6" />
        ))}
        <polyline fill="none" stroke={color} strokeWidth="2.3" points={points.join(" ")} />
        {values.map((value, index) => {
          const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
          const y = 100 - ((value - min) / range) * 80 - 10;
          return <circle key={`${index}-${value}`} cx={x} cy={y} r="1.7" fill={color} />;
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-(--sa-muted)">
        <span>{data[0]?.[labelKey as keyof ChartDatum] ?? ""}</span>
        <span className="font-semibold text-gray-900 dark:text-(--sa-text)" style={{ color: ink }}>
          {fmt(Number(values[values.length - 1] ?? 0))}
        </span>
      </div>
    </div>
  );
}

export function BarCompareChart({
  data,
  color = "#f59e0b",
  height = 260,
  labelKey = "label",
  valueKey = "value",
}: {
  data: ChartDatum[];
  color?: string;
  height?: number;
  labelKey?: string;
  valueKey?: string;
}) {
  const { ink } = usePalette();
  const max = Math.max(...data.map((item) => Number(item[valueKey] ?? 0)), 1);
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm dark:border-(--sa-border) dark:bg-(--sa-elevated)">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((item, index) => {
          const value = Number(item[valueKey] ?? 0);
          const h = Math.max(8, (value / max) * 100);
          return (
            <div key={`${item[labelKey as keyof ChartDatum] ?? index}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-md" style={{ height: `${h}%`, minHeight: 8, backgroundColor: color }} />
              <span className="text-[10px] text-gray-500 dark:text-(--sa-muted)">{String(item[labelKey as keyof ChartDatum] ?? "")}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-right text-[11px] text-gray-500 dark:text-(--sa-muted)" style={{ color: ink }}>
        {int(max)} max
      </div>
    </div>
  );
}

export function StatusDonutChart({ data, height = 220 }: { data: DonutSlice[]; height?: number }) {
  const { dark } = usePalette();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  // Each arc's start is the sum of every arc before it. Computed UP FRONT rather
  // than by mutating a counter inside .map(): reassigning a variable while
  // rendering makes the second render of the same data draw different arcs,
  // which is what react-hooks/immutability catches.
  const arcs = data.reduce<{ slice: DonutSlice; length: number; offset: number }[]>(
    (acc, slice) => {
      const length = total > 0 ? (slice.value / total) * circumference : 0;
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.length : 0;
      acc.push({ slice, length, offset });
      return acc;
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 120 120" className="shrink-0" style={{ width: height, height }}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke={dark ? "#3f3f46" : "#e5e7eb"} strokeWidth="18" />
        {arcs.map(({ slice, length, offset }) => (
          <circle
            key={slice.label}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="18"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        ))}
      </svg>
      <ul className="w-full space-y-2">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between text-sm text-gray-600 dark:text-(--sa-text-2)">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.label}
            </span>
            <span className="font-medium text-gray-900 dark:text-(--sa-text)">{int(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
