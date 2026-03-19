"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CrewmatesSection } from "@/components/interface/crewmates-section";
import { GreenhouseCharts } from "@/components/interface/greenhouse-charts";

const STAGGER_CHILDREN = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const FADE_UP = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function DashboardView() {
  return (
    <section
      aria-label="Dashboard view"
      className="absolute inset-0 bg-background overflow-y-auto"
    >
      <motion.div
        variants={STAGGER_CHILDREN}
        initial="hidden"
        animate="visible"
        className="flex h-full min-h-0 gap-5 px-6 pt-20 pb-[100px]"
      >
        {/* Left panel: Crew members */}
        <motion.div
          variants={FADE_UP}
          className="w-[380px] shrink-0 flex flex-col min-h-0 overflow-y-auto scrollbar-none"
        >
          <CrewmatesSection />
        </motion.div>

        {/* Right panel: Environment charts */}
        <motion.div
          variants={FADE_UP}
          className="flex-1 min-w-0 overflow-y-auto scrollbar-none"
        >
          <GreenhouseCharts />
        </motion.div>
      </motion.div>
    </section>
  );
}
