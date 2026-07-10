"use client";

// Animated count-up number. Uses the shared useCountUp hook (rAF, ease-out,
// reduced-motion aware) and formats with Intl for grouping / currency.
import * as React from "react";
import { useCountUp } from "@/lib/hooks/use-count-up";

export function CountUp({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  format = "int",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: "int" | "compact" | "inr";
}) {
  const n = useCountUp(value, { duration });

  const text = React.useMemo(() => {
    switch (format) {
      case "inr":
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(n);
      case "compact":
        return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
      default:
        return new Intl.NumberFormat("en-IN").format(n);
    }
  }, [n, format]);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
