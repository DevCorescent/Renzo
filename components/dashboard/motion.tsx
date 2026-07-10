"use client";

// Motion primitives for the admin dashboards — thin wrappers over framer-motion,
// all guarded by prefers-reduced-motion so they degrade to instant/no-op.
import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Fade + gentle rise when the element mounts. */
export function FadeIn({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

/** Container that staggers its <Stagger.Item> children into view. */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Item inside a <Stagger>. Optionally lifts on hover (for cards). */
export function StaggerItem({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("h-full", className)}
      variants={staggerChild}
      whileHover={hover && !reduce ? { y: -3 } : undefined}
      transition={{ duration: 0.2, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
