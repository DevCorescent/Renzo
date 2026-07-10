"use client";

// Lazy, client-only chart entry points. Recharts is code-split and never
// server-rendered (avoids ResponsiveContainer hydration warnings); a fixed-height
// skeleton reserves space so there is no layout shift while it loads.
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./loading-skeleton";

export const AreaTrendChart = dynamic(() => import("./charts").then((m) => m.AreaTrendChart), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[260px]" />,
});

export const BarCompareChart = dynamic(() => import("./charts").then((m) => m.BarCompareChart), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[260px]" />,
});

export const StatusDonutChart = dynamic(() => import("./charts").then((m) => m.StatusDonutChart), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[220px]" />,
});

export type { DonutSlice } from "./charts";
