"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Drop,
  Cloud,
  Wind,
  Sun,
  CaretRight,
} from "@phosphor-icons/react";
import { useGreenhouseStore } from "@/lib/greenhouse-store";
import { useAnimationConfig } from "@/lib/use-animation-config";

export function EnvWidgetShells() {
  const [expanded, setExpanded] = React.useState(false);
  const humidity = useGreenhouseStore((s) => s.humidity);
  const co2Level = useGreenhouseStore((s) => s.co2Level);
  const lightLevel = useGreenhouseStore((s) => s.lightLevel);
  const env = useGreenhouseStore((s) => s.environment);
  const anim = useAnimationConfig();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Hide readings" : "Show readings"}
        className="h-10 w-10 rounded-lg flex items-center justify-center bg-neutral-900 text-white/40 dark:bg-white/8 dark:text-white/40 hover:text-white hover:bg-neutral-700 dark:hover:bg-white/15 transition-colors"
      >
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={anim.enabled ? { duration: 0.2, ease: [0.32, 0.72, 0, 1] } : anim.instant}
          className="flex items-center justify-center"
        >
          <CaretRight size={14} weight="bold" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="flex items-center gap-2 overflow-hidden"
            initial={anim.enabled ? { width: 0, opacity: 0 } : false}
            animate={{ width: "auto", opacity: 1 }}
            exit={anim.enabled ? { width: 0, opacity: 0 } : undefined}
            transition={anim.enabled ? { duration: 0.25, ease: [0.32, 0.72, 0, 1] } : anim.instant}
          >
            <EnvShell
              icon={<Drop size={14} weight="fill" />}
              label="Humidity"
              value={`${Math.round(humidity)}%`}
            />
            <EnvShell
              icon={<Cloud size={14} weight="fill" />}
              label="CO₂"
              value={`${Math.round(co2Level)} ppm`}
            />
            <EnvShell
              icon={<Wind size={14} weight="fill" />}
              label="O₂"
              value={`${Math.round(env.o2Level * 10) / 10}%`}
            />
            <EnvShell
              icon={<Sun size={14} weight="fill" />}
              label="Light"
              value={`${Math.round(lightLevel)} lux`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnvShell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      title={label}
      className="h-10 rounded-lg flex items-center gap-1.5 px-3 bg-neutral-900 text-white dark:bg-white/8 dark:text-white/90 whitespace-nowrap"
    >
      <span className="text-white/40 dark:text-white/40">{icon}</span>
      <span className="text-base font-mono tabular-nums leading-5">{value}</span>
    </div>
  );
}
