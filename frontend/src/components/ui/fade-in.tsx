"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (delay: number) => ({
    opacity: 1,
    transition: { duration: 0.4, delay, ease: "easeOut" },
  }),
};

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (delay: number) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const slideInStartVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: (delay: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, delay, ease: "easeOut" },
  }),
};

type AnimationType = "fade-up" | "fade" | "scale" | "slide-start";

const variantMap: Record<AnimationType, Variants> = {
  "fade-up": fadeUpVariants,
  fade: fadeVariants,
  scale: scaleVariants,
  "slide-start": slideInStartVariants,
};

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  animation?: AnimationType;
  /** Set to true to skip motion and render a plain wrapper (for perf in long lists). */
  skip?: boolean;
}

/**
 * Wraps children in a motion.div that fades/slides in on mount.
 * Use `delay` to stagger multiple siblings (e.g. 0, 0.08, 0.16…).
 * Use `skip` to render without motion (avoids overhead in long lists).
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  animation = "fade-up",
  skip = false,
}: FadeInProps) {
  if (skip) {
    return className ? <div className={cn(className)}>{children}</div> : <>{children}</>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      custom={delay}
      variants={variantMap[animation]}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Helper: wraps each direct child in a staggered FadeIn.
 * Usage: <Stagger> <div/> <div/> <div/> </Stagger>
 */
export function Stagger({
  children,
  interval = 0.08,
  baseDelay = 0,
  className,
  animation = "fade-up",
}: {
  children: React.ReactNode;
  interval?: number;
  baseDelay?: number;
  className?: string;
  animation?: AnimationType;
}) {
  return (
    <div className={cn(className)}>
      {React.Children.map(children, (child, i) =>
        child ? (
          <FadeIn
            delay={baseDelay + i * interval}
            animation={animation}
          >
            {child}
          </FadeIn>
        ) : null
      )}
    </div>
  );
}
